package template

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/cyclops-ui/cycops-ctrl/internal/mapper"
	json "github.com/json-iterator/go"
	"gopkg.in/yaml.v2"
	helmchart "helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/registry"

	"github.com/cyclops-ui/cycops-ctrl/internal/models"
	"github.com/cyclops-ui/cycops-ctrl/internal/models/helm"
)

func LoadHelmChart(repo, chart, version string) (*models.Template, error) {
	var tgzData []byte
	var versions []string
	var err error
	if registry.IsOCI(repo) {
		tgzData, versions, err = loadOCIHelmChartBytes(repo, chart, version)
		if err != nil {
			return nil, err
		}
	} else {
		tgzData, versions, err = loadFromHelmChartRepo(repo, chart, version)
		if err != nil {
			return nil, err
		}
	}

	extractedFiles, err := unpackTgzInMemory(tgzData)
	if err != nil {
		return nil, err
	}

	return mapHelmChart(chart, versions, extractedFiles)
}

func LoadHelmChartInitialValues(repo, chart, version string) (map[interface{}]interface{}, error) {
	var tgzData []byte
	var err error
	if registry.IsOCI(repo) {
		tgzData, _, err = loadOCIHelmChartBytes(repo, chart, version)
		if err != nil {
			return nil, err
		}
	} else {
		tgzData, _, err = loadFromHelmChartRepo(repo, chart, version)
		if err != nil {
			return nil, err
		}
	}

	extractedFiles, err := unpackTgzInMemory(tgzData)
	if err != nil {
		return nil, err
	}

	valuesBytes := []byte{}

	for name, content := range extractedFiles {
		parts := strings.Split(name, "/")

		if len(parts) == 2 && parts[1] == "values.yaml" {
			valuesBytes = content
			break
		}
	}

	var values map[interface{}]interface{}
	if err := yaml.Unmarshal(valuesBytes, &values); err != nil {
		return nil, err
	}

	return mapHelmChartInitialValues(extractedFiles)
}

func IsHelmRepo(repo string) (bool, error) {
	indexURL, err := url.JoinPath(repo, "index.yaml")
	if err != nil {
		return false, err
	}

	req, err := http.NewRequest(http.MethodHead, indexURL, nil)
	if err != nil {
		return false, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

func loadFromHelmChartRepo(repo, chart, version string) ([]byte, []string, error) {
	tgzURL, versions, err := getTarUrl(repo, chart, version)
	if err != nil {
		return nil, nil, err
	}

	b, err := downloadFile(tgzURL)

	return b, versions, err
}

func mapHelmChart(chartName string, versions []string, files map[string][]byte) (*models.Template, error) {
	metadataBytes := []byte{}
	schemaBytes := []byte{}
	manifestParts := make([]string, 0)
	chartFiles := make([]*helmchart.File, 0)
	dependenciesFromChartsDir := make(map[string]map[string][]byte, 0)

	for name, content := range files {
		parts := strings.Split(name, "/")

		if len(parts) == 2 && parts[1] == "Chart.yaml" {
			metadataBytes = content
			continue
		}

		if len(parts) == 2 && parts[1] == "values.schema.json" {
			schemaBytes = content
			continue
		}

		if len(parts) > 2 && parts[1] == "templates" {
			manifestParts = append(manifestParts, string(content))
			continue
		}

		if len(parts) > 3 && parts[1] == "charts" {
			depName := parts[2]
			if _, ok := dependenciesFromChartsDir[depName]; !ok {
				dependenciesFromChartsDir[depName] = make(map[string][]byte)
			}

			dependenciesFromChartsDir[depName][path.Join(parts[2:]...)] = content
			continue
		}

		chartFiles = append(chartFiles, &helmchart.File{
			Name: path.Join(name[1:]),
			Data: content,
		})

	}

	var schema helm.Property
	// unmarshal values schema only if present
	if len(schemaBytes) != 0 {
		if err := json.Unmarshal(schemaBytes, &schema); err != nil {
			return &models.Template{}, err
		}
	}

	var metadata helmchart.Metadata
	if err := yaml.Unmarshal(metadataBytes, &metadata); err != nil {
		return &models.Template{}, err
	}

	// region load dependencies
	dependencies, err := loadDependencies(metadata)
	if err != nil {
		return &models.Template{}, err
	}

	for depName, files := range dependenciesFromChartsDir {
		if dependencyExists(depName, dependencies) {
			continue
		}

		dep, err := mapHelmChart(depName, []string{}, files)
		if err != nil {
			return nil, err
		}

		dependencies = append(dependencies, dep)
	}
	// endregion

	return &models.Template{
		Name:         chartName,
		Manifest:     strings.Join(manifestParts, "---\n"),
		Fields:       mapper.HelmSchemaToFields(schema, dependencies),
		Created:      "",
		Edited:       "",
		Version:      "",
		Files:        chartFiles,
		Dependencies: dependencies,
		Versions:     versions,
	}, nil
}

func mapHelmChartInitialValues(files map[string][]byte) (map[interface{}]interface{}, error) {
	metadataBytes := []byte{}
	valuesBytes := []byte{}
	dependenciesFromChartsDir := make(map[string]map[string][]byte, 0)

	for name, content := range files {
		parts := strings.Split(name, "/")

		if len(parts) == 2 && parts[1] == "Chart.yaml" {
			metadataBytes = content
			continue
		}

		if len(parts) == 2 && parts[1] == "values.yaml" {
			valuesBytes = content
			continue
		}

		if len(parts) > 3 && parts[1] == "charts" {
			depName := parts[2]
			if _, ok := dependenciesFromChartsDir[depName]; !ok {
				dependenciesFromChartsDir[depName] = make(map[string][]byte)
			}

			dependenciesFromChartsDir[depName][path.Join(parts[2:]...)] = content
			continue
		}
	}

	var values map[interface{}]interface{}
	if err := yaml.Unmarshal(valuesBytes, &values); err != nil {
		return nil, err
	}

	var metadata helmchart.Metadata
	if err := yaml.Unmarshal(metadataBytes, &metadata); err != nil {
		return nil, err
	}

	// region load dependencies
	for depName, files := range dependenciesFromChartsDir {
		dep, err := mapHelmChartInitialValues(files)
		if err != nil {
			return nil, err
		}

		values[depName] = dep
	}

	dependenciesFromMeta, err := loadDependenciesInitialValues(metadata)
	if err != nil {
		return nil, err
	}

	for depName, depValues := range dependenciesFromMeta {
		values[depName] = depValues
	}
	// endregion

	return values, nil
}

func getTarUrl(repo, chart, version string) (string, []string, error) {
	indexURL, err := url.JoinPath(repo, "index.yaml")
	if err != nil {
		return "", nil, err
	}

	response, err := http.Get(indexURL)
	if err != nil {
		return "", nil, err
	}
	defer response.Body.Close()

	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return "", nil, err
	}

	var data helm.Index
	err = yaml.Unmarshal(body, &data)
	if err != nil {
		return "", nil, err
	}

	if _, ok := data.Entries[chart]; !ok {
		return "", nil, errors.New(fmt.Sprintf("chart %v not found in repo %v", chart, repo))
	}

	v, err := resolveVersion(data.Entries[chart], version)
	if err != nil {
		return "", nil, err
	}

	URL := ""
	versions := make([]string, 0, len(data.Entries))
	for _, entry := range data.Entries[chart] {
		if entry.Version == v {
			if len(entry.URLs) == 0 {
				return "", nil, errors.New(fmt.Sprintf("empty URL on version %v of chart %v and repo %v", version, chart, repo))
			}

			URL = entry.URLs[0]
		}
		versions = append(versions, entry.Version)
	}

	if URL == "" {
		return "", nil, errors.New(fmt.Sprintf("version %v not found in chart %v and repo %v", version, chart, repo))
	}

	return URL, versions, nil
}

func resolveVersion(indexEntries []helm.IndexEntry, version string) (string, error) {
	if isValidVersion(version) {
		return version, nil
	}

	versions := make([]string, 0, len(indexEntries))
	for _, entry := range indexEntries {
		versions = append(versions, entry.Version)
	}

	return resolveSemver(version, versions)
}

func downloadFile(url string) ([]byte, error) {
	response, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP request failed with status: %s", response.Status)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func unpackTgzInMemory(tgzData []byte) (map[string][]byte, error) {
	// Create a gzip reader
	gzipReader, err := gzip.NewReader(bytes.NewReader(tgzData))
	if err != nil {
		return nil, err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)

	files := make(map[string][]byte)

	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if err != nil {
			return nil, err
		}

		var fileBuffer bytes.Buffer
		if _, err := io.Copy(&fileBuffer, tarReader); err != nil {
			return nil, err
		}

		files[header.Name] = fileBuffer.Bytes()
	}

	return files, nil
}

func dependencyExists(name string, existing []*models.Template) bool {
	for _, ed := range existing {
		if ed.Name == name {
			return true
		}
	}

	return false
}
