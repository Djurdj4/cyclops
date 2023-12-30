import React, {useEffect, useState} from 'react';
import {
    Alert,
    Button,
    Col,
    Collapse,
    Divider,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Switch,
    Typography,
    Tooltip, message, Modal, CollapseProps, Checkbox, Tag
} from 'antd';
import axios from 'axios';
import {useNavigate} from 'react-router';
import {MinusCircleOutlined, PlusOutlined, InfoCircleOutlined, StarFilled} from "@ant-design/icons";
import {fileExtension} from "../../utils/form";
import './custom.css';

import YAML from 'yaml'

import {useParams} from "react-router-dom";
import AceEditor from "react-ace";

import 'ace-builds/src-noconflict/theme-github';

import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/mode-toml';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/snippets/yaml'
import {numberInputValidators} from "../../utils/validators/number";
import {stringInputValidators} from "../../utils/validators/string";

const {Title} = Typography;
const layout = {
    wrapperCol: {span: 16},
};

const gitRefPlaceholder = {
    repo: "repository",
    path: "path",
    version: "revision",
}

const helmRefPlaceholder = {
    repo: "repository",
    path: "chart",
    version: "version",
}

const NewModule = () => {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        name: "",
        version: "",
        manifest: "",
        fields: [],
        properties: [],
        dependencies: []
    })

    const [gitTemplate, setGitTemplate] = useState({
        source: "git",
        repo: "",
        path: "",
        commit: "",
    })

    const [error, setError] = useState({
        message: "",
        description: "",
    });

    const [templateRefPlaceholder, setTemplateRefPlaceholder] = useState(gitRefPlaceholder)

    const [successLoad, setSuccessLoad] = useState(false);

    const [loadingTemplate, setLoadingTemplate] = useState(false);

    const [activeCollapses, setActiveCollapses] = useState(new Map());
    const updateActiveCollapses = (k: string[] | string, v: any) => {
        let kk = new Array(k);
        setActiveCollapses(new Map(activeCollapses.set(kk.join(''),v)));
    }

    var initLoadedFrom: string[];
    initLoadedFrom = [];
    const [newFile, setNewFile] = useState("");
    const [loadedFrom, setLoadedFrom] = useState(initLoadedFrom);
    const [loadedValues, setLoadedValues] = useState("");
    const [loadingValuesFile, setLoadingValuesFile] = useState(false);
    const [loadingValuesModal, setLoadingValuesModal] = useState(false);

    const history = useNavigate();

    const [form] = Form.useForm();

    useEffect(() => {
        setLoading(true);

        if (window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_REPO &&
            window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_REPO.length > 0) {
            setGitTemplate({
                source: "git",
                repo: window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_REPO,
                path: window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_PATH,
                commit: window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_VERSION,
            })

            loadTemplate(
                "git",
                window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_REPO,
                window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_PATH,
                window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_VERSION
            )
        }

        setLoading(false);
    }, []);

    const mapsToArray = (fields: any[], values: any): any => {
        let out: any = {};
        fields.forEach(field => {
            let valuesList: any[] = [];
            switch (field.type) {
                case "string":
                    out[field.name] = values[field.name]
                    break
                case "number":
                    out[field.name] = values[field.name]
                    break
                case "boolean":
                    out[field.name] = values[field.name]
                    break
                case "object":
                    if (values[field.name]) {
                        out[field.name] = mapsToArray(field.properties, values[field.name])
                    }
                    break
                case "array":
                    valuesList = values[field.name] as any[]

                    let objectArr: any[] = []
                    valuesList.forEach(valueFromList => {
                        switch (field.items.type) {
                            case "string":
                                objectArr.push(valueFromList)
                                break
                            case "object":
                                objectArr.push(mapsToArray(field.items.properties, valueFromList))
                                break
                        }
                    })
                    out[field.name] = objectArr
                    break
                case "map":
                    let object: any[] = [];

                    if (values[field.name] === undefined || values[field.name] === null) {
                        out[field.name] = {}
                        break
                    }

                    Object.keys(values[field.name]).forEach(key => {
                        object.push({
                            key: key,
                            value: values[field.name][key],
                        })
                    })

                    out[field.name] = object

                    // valuesList.forEach(valueFromList => {
                    //     // object.push({})
                    //     // object[valueFromList.key] = valueFromList.value
                    // })
                    // out[field.name] = object
                    break
            }
        })

        return out
    }

    const findMaps = (fields: any[], values: any): any => {
        let out: any = {};
        fields.forEach(field => {
            let valuesList: any[] = [];
            switch (field.type) {
                case "string":
                    out[field.name] = values[field.name]
                    break
                case "number":
                    out[field.name] = values[field.name]
                    break
                case "boolean":
                    out[field.name] = values[field.name]
                    break
                case "object":
                    if (values[field.name]) {
                        out[field.name] = findMaps(field.properties, values[field.name])
                    }
                    break
                case "array":
                    valuesList = values[field.name] as any[]

                    if (!valuesList) {
                        out[field.name] = []
                        break
                    }

                    let objectArr: any[] = []
                    valuesList.forEach(valueFromList => {
                        switch (field.items.type) {
                            case "string":
                                objectArr.push(valueFromList)
                                break
                            case "object":
                                objectArr.push(findMaps(field.items.properties, valueFromList))
                                break
                        }
                    })
                    out[field.name] = objectArr
                    break
                case "map":
                    valuesList = values[field.name] as any[]

                    if (!valuesList) {
                        out[field.name] = {}
                        break
                    }

                    let object: any = {};
                    valuesList.forEach(valueFromList => {
                        object[valueFromList.key] = valueFromList.value
                    })
                    out[field.name] = object
                    break
            }
        })

        return out
    }

    const handleSubmit = (values: any) => {
        const moduleName = values["cyclops_module_name"]

        values = findMaps(config.fields, values)

        axios.post(window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST + `/modules/new`,
            {
                name: moduleName,
                values: values,
                template: {
                    name: config.name,
                    version: config.version,
                    git: {
                        repo: gitTemplate.repo,
                        path: gitTemplate.path,
                        commit: gitTemplate.commit,
                    }
                },
            })
            .then(res => {
                window.location.href = "/modules/" + moduleName
            })
            .catch(error => {
                setLoading(false);
                if (error.response === undefined) {
                    setError({
                        message: String(error),
                        description: "Check if Cyclops backend is available on: " + window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST
                    })
                    setSuccessLoad(false);
                } else {
                    setError(error.response.data);
                    setSuccessLoad(false);
                }
            })
    }

    // TODO: will be used later for commit references
    // const handleChange = (value: any) => {
    //     setConfig({
    //         name: value,
    //         version: "",
    //         manifest: "",
    //         fields: [],
    //         properties: [],
    //     })
    //
    //     axios.get(window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST + `/configuration/` + value + `/versions`).then(res => {
    //         let configVersions = res.data.sort(function (a: string, b: string) {
    //             if (a === "latest") {
    //                 return -1
    //             }
    //             if (b === "latest") {
    //                 return 1
    //             }
    //             if (a < b) {
    //                 return 1;
    //             }
    //             if (a > b) {
    //                 return -1;
    //             }
    //             return 0;
    //         })
    //
    //         console.log(configVersions);
    //
    //         const versionOptions: {} | any = [];
    //         configVersions.map((v: any) => {
    //             versionOptions.push(<Select.Option key={v}>{v}</Select.Option>)
    //         })
    //     });
    // }
    //
    // const handleVersionChange = (value: any) => {
    //     axios.get(window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST + `/create-config/` + config.name + `?version=` + value).then(res => {
    //         setConfig(res.data);
    //     });
    // }

    const loadTemplate = async (source: string, repo: string, path: string, commit: string) => {
        setLoadingTemplate(true);

        setError({
            message: "",
            description: "",
        })

        if (repo.trim() === "") {
            setError({
                message: "Invalid repository name",
                description: "Repository name must not be empty",
            })
            setLoadingTemplate(false);
            return
        }

        let tmpConfig: any = {}

        await axios.get(window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST + `/templates/git?source=` + source +`&repo=` + repo + `&path=` + path + `&commit=` + commit).then(templatesRes => {
            setConfig(templatesRes.data);
            tmpConfig = templatesRes.data;

            setError({
                message: "",
                description: "",
            });
            setSuccessLoad(true);
            setLoadingTemplate(false);
        }).catch(function (error) {
            setLoadingTemplate(false);
            if (error.response === undefined) {
                setError({
                    message: String(error),
                    description: "Check if Cyclops backend is available on: " + window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST
                })
                setSuccessLoad(false);
            } else {
                setError(error.response.data);
                setSuccessLoad(false);
            }
        });

        axios.get(window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST + `/templates/git/initial?source=` + source +`&repo=` + repo + `&path=` + path + `&commit=` + commit).then(res => {
            form.setFieldsValue(mapsToArray(tmpConfig.fields, res.data))

            setError({
                message: "",
                description: "",
            });
            // setSuccessLoad(true);
            // setLoadingTemplate(false);
        }).catch(function (error) {
            // setLoadingTemplate(false);
            // setSuccessLoad(false);
            if (error.response === undefined) {
                setError({
                    message: String(error),
                    description: "Check if Cyclops backend is available on: " + window.__RUNTIME_CONFIG__.REACT_APP_CYCLOPS_CTRL_HOST
                })
            } else {
                setError(error.response.data);
            }
        });

        setActiveCollapses(new Map());
    }

    const onLoadFromFile = () => {
        setLoadingValuesFile(true)
        setLoadedValues("")

        if (newFile.trim() === "") {
            setError({
                message: "Invalid values file",
                description: "Values file can't be empty"
            })
            return
        }

        setLoadingValuesModal(true)

        loadValues(newFile)
        setLoadingValuesFile(false)
    }

    const getCollapseColor = (fieldName: string) => {
        let kk = new Array(fieldName);
        let key = kk.join('')
        if (activeCollapses.get(key) && activeCollapses.get(key) === true) {
            return "#faca93"
        } else {
            return "#fae8d4"
        }
    }

    const selectInputField = (field: any, formItemName: string | string[], arrayField: any, isRequired: boolean) => {
        let options: {value: string, label: string}[] = []
        field.enum.forEach((option: any) => {
            options.push({
                value: option,
                label: option,
            })
        })

        return <Form.Item {...arrayField} name={formItemName} rules={[{required: isRequired}]}
                  label={
                      <div>
                          {field.display_name}
                          <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                      </div>
                  }
            >
            <Select
                showSearch
                placeholder={field.name}
                optionFilterProp="children"
                filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={options}
            />
        </Form.Item>
    }

    const fileField = (field: any, formItemName: string | string[], arrayField: any, isRequired: boolean) => {
        return <Form.Item {...arrayField} name={formItemName}
                          label={
                              <div>
                                  {field.display_name}
                                  <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                              </div>
                          }
                          rules={stringInputValidators(field, isRequired)}
        >
            <AceEditor
                mode={fileExtension(field.fileExtension)}
                theme="github"
                fontSize={12}
                showPrintMargin={true}
                showGutter={true}
                highlightActiveLine={true}
                setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 4,
                    useWorker: false
                }}
                style={{
                    height: "25em",
                    width: "100%"
                }}
            />
        </Form.Item>
    }

    const arrayInnerField = (field: any, parentFieldID: string, parent: string, level: number, arrayField: any, remove: Function) => {
        switch (field.items.type) {
            case "object":
                return <div>
                    {mapFields(field.items.properties, parentFieldID, "", level + 1, 2, arrayField)}
                    <MinusCircleOutlined style={{ fontSize: '16px' }} onClick={() => remove(arrayField.name)} />
                </div>
            case "string":
                return <Row>
                    <Form.Item style={{paddingBottom: "0px", marginBottom: "0px"}} wrapperCol={24} {...arrayField} initialValue={field.initialValue} name={[arrayField.name]}>
                        <Input/>
                    </Form.Item>
                    <MinusCircleOutlined style={{ fontSize: '16px', paddingLeft: "10px"}} onClick={() => remove(arrayField.name)} />
                </Row>
        }
    }

    function getValueFromNestedObject(obj: any, keys: string[]): any {
        let currentObj = obj;

        for (const key of keys) {
            if (typeof currentObj === 'object' && currentObj !== null && key in currentObj) {
                currentObj = currentObj[key];
            } else {
                return false;
            }
        }

        return currentObj;
    }

    function mapFields(fields: any[], parentFieldID: string | string[], parent: string, level: number, arrayIndexLifetime: number, arrayField?: any, required?: string[]) {
        const formFields: {} | any = [];

        if (!fields) {
            return <></>
        }

        fields.forEach((field: any) => {
            let fieldName = field.name

            let formItemName = arrayField ? [arrayField.name, fieldName] : fieldName

            let uniqueFieldName : any = parentFieldID.length === 0 ? field.name : parentFieldID.concat(".").concat(field.name)

            let isRequired = false;

            if (required) {
                for (let r of required) {
                    if (r === field.name) {
                        isRequired = true
                        break
                    }
                }
            }

            if (arrayIndexLifetime > 0) {
                arrayIndexLifetime = arrayIndexLifetime - 1;
            }

            switch (field.type) {
                case "string":
                    if (field.enum) {
                        formFields.push(selectInputField(field, formItemName, arrayField, isRequired))
                        return;
                    }

                    if (field.fileExtension && field.fileExtension.length > 0) {
                        formFields.push(fileField(field, formItemName, arrayField, isRequired))
                        return;
                    }

                    formFields.push(
                        <Form.Item {...arrayField} name={formItemName}
                            label={
                                <div>
                                    {field.display_name}
                                    <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                                </div>
                            }
                            rules={stringInputValidators(field, isRequired)}
                        >
                            <Input/>
                        </Form.Item>
                    )
                    return;
                case "number":
                    formFields.push(
                        <Form.Item {...arrayField} initialValue={field.initialValue} name={formItemName}
                            label={
                                <div>
                                    {field.display_name}
                                    <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                                </div>
                            }
                            rules={numberInputValidators(field, isRequired)}
                        >
                            <InputNumber style={{width: '100%'}} />
                        </Form.Item>
                    )
                    return;
                case "boolean":
                    let moduleValues: any = form.getFieldsValue()

                    let k = []
                    for (const item of parentFieldID) {
                        if (item === '') {
                            continue
                        }

                        k.push(item)
                    }
                    k.push(fieldName)

                    let checked = getValueFromNestedObject(moduleValues, k) === true ? "checked" : "unchecked"
                    formFields.push(
                        <Form.Item initialValue={field.initialValue} name={fieldName} id={fieldName}
                            valuePropName={checked}
                            label={
                                <div>
                                   {field.display_name}
                                   <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                                </div>
                            }
                        >
                            <Switch />
                        </Form.Item>
                    )
                    return;
                case "object":
                    uniqueFieldName = parentFieldID.length === 0 ? field.name : parentFieldID.concat(".").concat(field.name)
                    var header = <Row>{field.name}</Row>

                    if (field.description && field.description.length !== 0) {
                        header = <Row gutter={[0, 8]}>
                            <Col span={15} style={{display: 'flex', justifyContent: 'flex-start'}}>
                                {field.name}
                            </Col>
                            <Col span={9} style={{display: 'flex', justifyContent: 'flex-end'}}>
                                <Tooltip title={field.description} trigger={["hover", "click"]}>
                                    <InfoCircleOutlined style={{right: "0px", fontSize: '20px'}}/>
                                </Tooltip>
                            </Col>
                        </Row>
                    }

                    formFields.push(
                        <Col span={level === 0 ? 16 : 24} offset={level === 0 ? 2 : 0} style={{
                            paddingBottom: "15px",
                            marginLeft: "0px",
                            marginRight: "0px",
                            paddingLeft: "0px",
                            paddingRight: "0px",
                        }}>
                            <Collapse size={"small"} onChange={function (value: string | string[]) {
                                if (value.length === 0) {
                                    updateActiveCollapses(uniqueFieldName, false)
                                } else {
                                    updateActiveCollapses(uniqueFieldName, true)
                                }
                            }}>
                                <Collapse.Panel key={fieldName} header={header} style={{backgroundColor: getCollapseColor(uniqueFieldName)}} forceRender={true}>
                                    <Form.List name={formItemName}>
                                        {(arrFields, { add, remove }) => (
                                            <>
                                                {mapFields(field.properties, [fieldName], "", level + 1, arrayIndexLifetime, arrayIndexLifetime > 0 ? arrayField : undefined, field.required)}
                                            </>
                                        )}
                                    </Form.List>
                                </Collapse.Panel>
                            </Collapse>
                        </Col>
                    )
                    return;
                case "array":
                    uniqueFieldName = parentFieldID.length === 0 ? field.name : parentFieldID.concat(".").concat(field.name)
                    var header = <Row>{field.name}</Row>

                    if (field.description && field.description.length !== 0) {
                        header = <Row gutter={[0, 8]}>
                            <Col span={15} style={{display: 'flex', justifyContent: 'flex-start'}}>
                                {field.name}
                            </Col>
                            <Col span={9} style={{display: 'flex', justifyContent: 'flex-end'}}>
                                <Tooltip title={field.description} trigger={["hover", "click"]}>
                                    <InfoCircleOutlined style={{right: "0px", fontSize: '20px'}}/>
                                </Tooltip>
                            </Col>
                        </Row>
                    }

                    formFields.push(
                        <Col span={level === 0 ? 16 : 24} offset={level === 0 ? 2 : 0} style={{
                            paddingBottom: "15px",
                            marginLeft: "0px",
                            marginRight: "0px",
                            paddingLeft: "0px",
                            paddingRight: "0px",
                        }}>
                            <Collapse size={"small"} onChange={function (value: string | string[]) {
                                if (value.length === 0) {
                                    updateActiveCollapses(uniqueFieldName, false)
                                } else {
                                    updateActiveCollapses(uniqueFieldName, true)
                                }
                            }}>
                                <Collapse.Panel key={fieldName} header={header} style={{backgroundColor: getCollapseColor(uniqueFieldName)}} forceRender={true}>
                                    <Form.List name={formItemName}>
                                        {(arrFields, { add, remove }) => (
                                            <>
                                                {arrFields.map((arrField) => (
                                                    <Col key={arrField.key}>
                                                        {arrayInnerField(field, uniqueFieldName.concat(".").concat(arrField.name), "", level + 1, arrField, remove)}
                                                        <Divider/>
                                                    </Col>
                                                ))}

                                                <Form.Item>
                                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                                        Add
                                                    </Button>
                                                </Form.Item>
                                            </>
                                        )}
                                    </Form.List>
                                </Collapse.Panel>
                            </Collapse>
                        </Col>
                    )
                    return;
                case "map":
                    formFields.push(
                        <Form.Item name={fieldName} rules={[{required: isRequired}]}
                            label={
                                <div>
                                   {field.display_name}
                                   <p style={{color: "#8b8e91", marginBottom: "0px"}}>{field.description}</p>
                                </div>
                            }
                        >
                            <Form.List name={formItemName} initialValue={[]}>
                                {(fields, {add, remove}) => (
                                    <>
                                        {fields.map((arrField) => (
                                            <Space key={arrField.key} style={{display: 'flex', marginBottom: 8}}
                                                   align="baseline">
                                                <Form.Item
                                                    {...arrField}
                                                    name={[arrField.name, 'key']}
                                                    rules={[{required: true, message: 'Missing key'}]}
                                                >
                                                    <Input/>
                                                </Form.Item>
                                                <Form.Item
                                                    {...arrField}
                                                    name={[arrField.name, 'value']}
                                                    rules={[{required: true, message: 'Missing value'}]}
                                                >
                                                    <Input/>
                                                </Form.Item>
                                                <MinusCircleOutlined onClick={() => remove(arrField.name)}/>
                                            </Space>
                                        ))}
                                        <Form.Item>
                                            <Button type="dashed" onClick={() => {
                                                add()
                                            }} block icon={<PlusOutlined/>}>
                                                Add
                                            </Button>
                                        </Form.Item>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>
                    )
            }
        })

        return formFields
    }

    const handleCancel = () => {
        setLoadingValuesModal(false);
    };

    const handleImportValues = () => {
        form.setFieldsValue(YAML.parse(loadedValues))
        setLoadedValues("")
        setLoadingValuesModal(false);
    };

    const renderLoadedFromFiles = () => {
        if (loadedFrom.length === 0) {
            return
        }

        const files: {} | any = [];

        loadedFrom.forEach((value: string) => {
            files.push(<p>{value}</p>)
        })

        return <Collapse ghost items={[
            {
                key: '1',
                label: 'Imported values from',
                children: files,
            }
        ]} />
    }

    const loadValues = (fileName: string) => {
        axios.get(fileName).then(res => {
            setLoadedValues(res.data)
            setError({
                message: "",
                description: ""
            })
            let tmp = loadedFrom
            tmp.push(newFile)
            setLoadedFrom(tmp)
        }).catch(function (error) {
            // setLoadingTemplate(false);
            // setSuccessLoad(false);
            if (error.response === undefined) {
                setError({
                    message: String(error),
                    description: "Error loading file; Check if the file path is correct"
                })
            } else {
                setError({
                    message: error.response.data,
                    description: "Unable to fetch values file; Check if the file path is correct"
                })
            }
        });
    }

    const onFinishFailed = () => {
        message.error('Submit failed!');
    };

    return (
        <div>
            {
                error.message.length !== 0 && <Alert
                    message={error.message}
                    description={error.description}
                    type="error"
                    closable
                    afterClose={() => {setError({
                        message: "",
                        description: "",
                    })}}
                    style={{marginBottom: '20px'}}
                />
            }
            {
                successLoad && <Alert
                    message={"Loaded template successfully"}
                    type="success"
                    closable
                    afterClose={() => {
                        setSuccessLoad(false);
                    }}
                    style={{marginBottom: '20px'}}
                />
            }
            <Row gutter={[40, 0]}>
                <Col span={23}>
                    <Title style={{textAlign: 'center'}} level={2}>
                        Define Module
                    </Title>
                </Col>
            </Row>
            <Row gutter={[40, 0]}>
                <Col span={24}>
                    <Form
                        {...layout}
                        form={form}
                        layout="vertical"
                        autoComplete={"off"}
                        onFinish={handleSubmit}
                        onFinishFailed={onFinishFailed}
                    >
                        <Divider orientation="left" orientationMargin="0">
                            Module template
                        </Divider>
                        <Select
                            style={{width: '8%'}}
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            defaultValue={"git"}
                            options={[
                                {
                                    value: "git",
                                    label: "git",
                                },
                                {
                                    value: "helm",
                                    label: "helm",
                                }
                            ]}
                            onChange={function (value: any) {
                                if (value === "helm") {
                                    setTemplateRefPlaceholder(helmRefPlaceholder)
                                } else if (value === "git") {
                                    setTemplateRefPlaceholder(gitRefPlaceholder)
                                }
                                setGitTemplate({
                                    source: value,
                                    repo: gitTemplate.repo,
                                    path: gitTemplate.path,
                                    commit: gitTemplate.commit,
                                })
                            }}
                        />
                        {' '}
                        <Input
                            placeholder={templateRefPlaceholder.repo}
                            style={{width: '40%'}}
                            onChange={(value: any) => {
                                setGitTemplate({
                                    source: gitTemplate.source,
                                    repo: value.target.value,
                                    path: gitTemplate.path,
                                    commit: gitTemplate.commit,
                                })
                            }}
                            defaultValue={window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_REPO}
                        />
                        {' / '}
                        <Input
                            placeholder={templateRefPlaceholder.path}
                            style={{width: '20%'}}
                            onChange={(value: any) => {
                                setGitTemplate({
                                    source: gitTemplate.source,
                                    repo: gitTemplate.repo,
                                    path: value.target.value,
                                    commit: gitTemplate.commit,
                                })
                            }}
                            defaultValue={window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_PATH}
                        />
                        {' @ '}
                        <Input
                            placeholder={templateRefPlaceholder.version}
                            style={{width: '10%'}}
                            onChange={(value: any) => {
                                setGitTemplate({
                                    source: gitTemplate.source,
                                    repo: gitTemplate.repo,
                                    path: gitTemplate.path,
                                    commit: value.target.value
                                })
                            }}
                            defaultValue={window.__RUNTIME_CONFIG__.REACT_APP_DEFAULT_TEMPLATE_VERSION}
                        />
                        {'  '}
                        <Button
                            type="primary"
                            htmlType="button"
                            onClick={async () => {await loadTemplate(
                                gitTemplate.source,
                                gitTemplate.repo,
                                gitTemplate.path,
                                gitTemplate.commit,
                            )}}
                            loading={loadingTemplate}
                        >
                            Load
                        </Button>
                        <Divider orientation="left" orientationMargin="0">
                            Module name
                        </Divider>
                        <Form.Item name="cyclops_module_name" id="cyclops_module_name"
                                   label={
                                       <div>
                                           Module name
                                           <p style={{color: "#8b8e91", marginBottom: "0px"}}>Enter a unique module name</p>
                                       </div>
                                   }
                                   rules={[
                                       {
                                           required: true,
                                           message: 'Module name is required',
                                       }
                                   ]}
                        >
                            <Input/>
                        </Form.Item>
                        <Divider orientation="left" orientationMargin="0">
                            Define Module
                        </Divider>
                        {mapFields(config.fields, "",  "" , 0, 0)}
                        <div style={{textAlign: "right"}}>
                            <Button loading={loading} onClick={function () {setLoadingValuesModal(true)}} name="Save">
                                Load values from file
                            </Button>{' '}
                            <Button type="primary" loading={loading} htmlType="submit" name="Save">
                                Save
                            </Button>{' '}
                            <Button htmlType="button" onClick={() => history('/')}>
                                Back
                            </Button>
                        </div>
                    </Form>
                </Col>
            </Row>
            <Modal
                title="Values to import"
                visible={loadingValuesModal}
                onCancel={handleCancel}
                onOk={handleImportValues}
                width={'50%'}
            >
                {
                    error.message.length !== 0 && <Alert
                        message={error.message}
                        description={error.description}
                        type="error"
                        closable
                        afterClose={() => {setError({
                            message: "",
                            description: "",
                        })}}
                        style={{marginBottom: '20px'}}
                    />
                }
                {renderLoadedFromFiles()}
                <Input
                    placeholder={"File reference"}
                    style={{width: '90%', marginBottom: "10px"}}
                    onChange={(value: any) => {
                        setNewFile(value.target.value)
                    }}
                />
                {'  '}
                <Button
                    type="primary"
                    htmlType="button"
                    style={{width: '9%'}}
                    onClick={onLoadFromFile}
                    loading={loadingValuesFile}
                >
                    Load
                </Button>
                <AceEditor
                    mode={"yaml"}
                    theme="github"
                    fontSize={12}
                    showPrintMargin={true}
                    showGutter={true}
                    highlightActiveLine={true}
                    onChange={setLoadedValues}
                    setOptions={{
                        enableBasicAutocompletion: true,
                        enableLiveAutocompletion: true,
                        enableSnippets: false,
                        showLineNumbers: true,
                        tabSize: 4,
                        useWorker: false
                    }}
                    style={{
                        height: "25em",
                        width: "100%"
                    }}
                    value={loadedValues}
                />
            </Modal>
        </div>
    );
}
export default NewModule;
