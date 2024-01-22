package models

import (
	"helm.sh/helm/v3/pkg/chart"

	"github.com/cyclops-ui/cycops-ctrl/internal/models/dto"
)

type Template struct {
	Name     string       `json:"name"`
	Manifest string       `json:"manifest"`
	Fields   []Field      `json:"fields"`
	Created  string       `json:"created"`
	Edited   string       `json:"edited"`
	Modules  []dto.Module `json:"modules"`
	Version  string       `json:"version"`
	Versions []string     `json:"versions"`

	Files []*chart.File `json:"files"`

	Dependencies []*Template `json:"dependencies"`
}

type Field struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Type          string   `json:"type"`
	DisplayName   string   `json:"display_name"`
	ManifestKey   string   `json:"manifest_key"`
	Value         string   `json:"value"`
	Properties    []Field  `json:"properties"`
	Items         *Field   `json:"items"`
	Enum          []string `json:"enum"`
	Required      []string `json:"required"`
	FileExtension string   `json:"fileExtension"`

	// number validation
	Minimum    *float64 `json:"minimum"`
	Maximum    *float64 `json:"maximum"`
	MultipleOf *float64 `json:"multipleOf"`

	// string validation
	MinLength *int `json:"minLength"`
	MaxLength *int `json:"maxLength"`
}
