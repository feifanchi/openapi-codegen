export interface IPropertyType {
  /** 类型 */
  type?: string;
  /** 格式，辅助type */
  format?: string;
  /** 引用 */
  $ref?: string;
  /** 数组类型 */
  items?: PropertyType;
  /** 描述 */
  description?: string;
  /** 枚举 */
  enum?: string[];
}

export enum TypeEnum {
  /** 基础类型:string,number */
  BASIC,
  /** 需要new基础类型 Date */
  BASIC_NEW,
  /** 需要new内部类型 */
  INNER,
  /** 外部类型 */
  OUTER,
  /** 需要new外部类型:Decimal */
  OUTER_NEW,
  /** 枚举 */
  ENUM
}

export interface TPropertyType {
  /** 类型名称 */
  name: string;
  /** 数组 */
  arrayLevel: number;
  /** 引入 */
  importUrl?: string;
  /** 内部类型 */
  type: TypeEnum;
  /** 描述 */
  description?: string;
}

/** 属性类型 */
export class PropertyType {
  /** 类型 */
  type?: string;
  /** 格式，辅助type */
  format?: string;
  /** 引用 */
  $ref?: string;
  /** 引用的Schema */
  refSchema?: SchemaSchema;
  /** 数组类型 */
  items?: PropertyType;
  /** 描述 */
  description?: string;
  /** 枚举名称 */
  enumName?: string;
  /** 枚举 */
  enums?: { code: string, description?: string }[];

  constructor(arg: IPropertyType) {
    this.type = arg.type;
    this.format = arg.format;
    if (arg.$ref) {
      this.$ref = arg.$ref.replace("#/components/schemas/", "");
      this.type = arg.$ref.replace("#/components/schemas/", "");
    }
    this.items = arg.items && new PropertyType(arg.items);
    this.description = arg.description;
    if (arg.enum) {
      this.enums = [];
      this.enumName = arg.description?.split("[")?.[1]?.replace("]", "")
      for (let e of arg.enum) {
        let items = e.trim().replace("*/", "").split("/**");
        this.enums.push({code: items[0], description: items?.[1]});
      }
    }
  }

  initProperty(map: Map<string, SchemaSchema>) {
    if (this.$ref) {
      if (this.$ref.includes("$$")) {
        this.$ref = this.$ref.split("$$")[0];
      }
      this.refSchema = map.get(this.$ref);
    }
    if (this.items) {
      this.items.initProperty(map);
    }
  }

  getEnumSchema(): { name: string; schema: EnumSchema } | undefined {
    if (this.enumName) {
      return {
        name: this.enumName,
        schema: new EnumSchema(this.enums!, '')
      }
    }
    return undefined;
  }

  getTypescriptType(level: number = 0): TPropertyType {
    // 数组类型
    if (this.type === 'array') {
      let arrayType = this.items!.getTypescriptType(level + 1);
      return {
        name: arrayType.name,
        arrayLevel: arrayType.arrayLevel,
        type: arrayType.type,
        importUrl: arrayType.importUrl,
        description: this.description
      }
    }
    // 枚举类型
    if (this.enumName) {
      return {
        name: this.enumName,
        type: TypeEnum.ENUM,
        arrayLevel: level,
        description: this.description
      }
    }
    if (this.type === 'integer') {
      if (this.format === 'int32') {
        return {
          name: 'number', type: TypeEnum.BASIC,
          arrayLevel: level, description: this.description
        };
      } else if (this.format === 'int64') {
        return {
          name: 'string', type: TypeEnum.BASIC,
          arrayLevel: level, description: this.description
        };
      }
    } else if (this.type == 'number') {
      if (this.format === 'float' || this.format === 'double') {
        return {
          name: 'number', type: TypeEnum.BASIC,
          arrayLevel: level, description: this.description
        }
      }
      return {
        name: 'Decimal',
        type: TypeEnum.OUTER_NEW,
        importUrl: "import Decimal from 'decimal.js';",
        arrayLevel: level,
        description: this.description
      }
    } else if (this.type === 'string') {
      if (this.format === 'date' || this.format === 'date-time') {
        return {
          name: 'Date', type: TypeEnum.BASIC_NEW,
          arrayLevel: level, description: this.description
        }
      }
      return {
        name: 'string', type: TypeEnum.BASIC,
        arrayLevel: level, description: this.description
      }
    } else if (this.type === 'boolean') {
      return {
        name: 'boolean', type: TypeEnum.BASIC,
        arrayLevel: level, description: this.description
      }
    }
    // 引用类型
    if (this.$ref) {
      return {
        name: this.$ref, type: TypeEnum.INNER,
        arrayLevel: level, description: this.description
      }
    }
    // object
    if (this.type === 'object') {
      return {
        name: 'any', type: TypeEnum.BASIC,
        arrayLevel: level, description: this.description
      };
    }
    throw new Error(`不支持的类型:${JSON.stringify(this)}`);
  }

  getExample(fetcheds: Set<string> = new Set<string>()): any {
    // 枚举类型
    if (this.enumName) {
      return this.enums![0].code;
    }
    if (this.type === 'integer') {
      if (this.format === 'int32') {
        return 1;
      } else if (this.format === 'int64') {
        return "2";
      }
    } else if (this.type == 'number') {
      if (this.format === 'float' || this.format === 'double') {
        return 3.1;
      }
      return 5.1;
    } else if (this.type === 'string') {
      if (this.format === 'date') {
        return '2020-01-01';
      } else if (this.format === 'date-time') {
        return '2020-01-01 01:02:03';
      }
      return 'example';
    } else if (this.type === 'boolean') {
      return true;
    }
    // 引用类型
    if (this.$ref) {
      if (fetcheds.has(this.$ref)) {
        return {};
      }
      fetcheds.add(this.$ref);
      return this.refSchema?.getExample(fetcheds);
    }
    // object
    if (this.type === 'object') {
      return {};
    }
    // 数组
    if (this.type === 'array') {
      return [this.items?.getExample(fetcheds)];
    }
    return undefined;
  }
}

export interface ISchema extends IPropertyType {
  required?: string[];
  properties?: { [key: string]: IPropertyType };
}


export interface ISchemaDefinition {
  /** 代码 */
  codeText: string;
  /** 引用列表 */
  importUrls: string[];
}

export interface SchemaPropertyMeta {
  /** 层级 */
  level: number;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 是否必填 */
  require: boolean;
  /** 类型 */
  type: TPropertyType
}

/**
 * schema 定义
 */
export class SchemaSchema extends PropertyType {
  required: string[];
  properties: Map<string, PropertyType> = new Map<string, PropertyType>();

  constructor(arg: ISchema) {
    super({...arg});
    this.required = arg.required || [];
    for (let property in arg.properties) {
      this.properties.set(property, new PropertyType(arg.properties[property]));
    }
  }

  override getExample(fetcheds: Set<string> = new Set<string>()): any {
    let res: any = {};
    for (let [name, property] of this.properties) {
      let type = property.getTypescriptType();
      res[name] = property.getExample(fetcheds);
      if (type.type === TypeEnum.INNER) {
        if (!fetcheds.has(type.name)) {
          fetcheds.add(type.name);
          if (type.arrayLevel) {
            res[name] = [property.items!.getExample(fetcheds)];
          } else {
            res[name] = property.refSchema!.getExample(fetcheds);
          }
        }
      }
    }
    return res;
  }

  getSchemaPropertyMetas(level: number, fetcheds: Set<string> = new Set<string>()): SchemaPropertyMeta[] {
    const res: SchemaPropertyMeta[] = [];
    for (let [name, property] of this.properties) {
      let require = this.required.includes(name);
      let type = property.getTypescriptType();
      // 名称，描述，是否必填，类型
      res.push({
        name,
        type,
        require,
        description: property.description,
        level,
      });
      if (type.type === TypeEnum.INNER) {
        if (!fetcheds.has(type.name)) {
          fetcheds.add(type.name);
          if (type.arrayLevel) {
            let items = property.items!;
            while (!items.refSchema && items.items) {
              items = items?.items!;
            }
            if (items.refSchema) {
              res.push(...items.refSchema.getSchemaPropertyMetas(level + 1, fetcheds))
            }
          } else {
            res.push(...property.refSchema!.getSchemaPropertyMetas(level + 1, fetcheds))
          }
        }
      }
    }
    return res;
  }


  initSchema(map: Map<string, SchemaSchema>) {
    for (let [property, propertyType] of this.properties) {
      propertyType.initProperty(map);
    }
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getEnumSchemas(): { name: string; schema: EnumSchema }[] {
    let ret: { name: string; schema: EnumSchema }[] = [];
    for (let [key, property] of this.properties) {
      let enumSchema = property.getEnumSchema();
      if (enumSchema) {
        ret.push(enumSchema);
      }
    }
    return ret;
  }

  getSchemaDefinition(name: string): ISchemaDefinition {
    let importUrls: string[] = [];
    /** 接口属性 */
    let propertyCodes: string[] = [];
    /** 类构造函数赋值 */
    let assignCodes: string[] = [];
    for (let [property, propertyType] of this.properties) {
      let type = propertyType.getTypescriptType();
      propertyCodes.push(`/** ${type.description} */`)
      if (this.required.includes(property)) {
        propertyCodes.push(`${property}: ${type.name}${'[]'.repeat(type.arrayLevel)};`);
      } else {
        propertyCodes.push(`${property}?: ${type.name}${'[]'.repeat(type.arrayLevel)};`);
      }
      if (type.arrayLevel) {
        let itemArray = ".map(item0 =>";
        for (let i = 1; i < type.arrayLevel; i++) {
          itemArray = itemArray + `item${i - 1}.map(item${i} =>`;
        }
        if (type.type === TypeEnum.BASIC) {
          assignCodes.push(`this.${property} = args.${property};`);
        } else if (type.type === TypeEnum.BASIC_NEW) {
          assignCodes.push(`this.${property} = args.${property}?${itemArray} new ${type.name}(item${type.arrayLevel - 1})${')'.repeat(type.arrayLevel)};`);
        } else if (type.type === TypeEnum.INNER) {
          assignCodes.push(`this.${property} = args.${property}?${itemArray} new C${type.name}(item${type.arrayLevel - 1})${')'.repeat(type.arrayLevel)};`);
        } else if (type.type === TypeEnum.OUTER_NEW) {
          importUrls.push(type.importUrl!);
          assignCodes.push(`this.${property} = args.${property}?${itemArray} new ${type.name}(item${type.arrayLevel - 1})${')'.repeat(type.arrayLevel)};`);
        } else if (type.type === TypeEnum.OUTER) {
          importUrls.push(type.importUrl!);
          assignCodes.push(`this.${property} = args.${property};`);
        } else if (type.type === TypeEnum.ENUM) {
          assignCodes.push(`this.${property} = args.${property}?.map(item => item as ${type.name});`);
        }
      } else {
        if (type.type === TypeEnum.INNER) {
          importUrls.push(type.importUrl!);
          assignCodes.push(`this.${property} = args.${property} && new C${type.name}(args.${property});`);
        } else if (type.type === TypeEnum.ENUM) {
          assignCodes.push(`this.${property} = args.${property} as ${type.name};`);
        } else if (type.type === TypeEnum.OUTER_NEW) {
          importUrls.push(type.importUrl!);
          assignCodes.push(`this.${property} = args.${property} && new ${type.name}(args.${property});`);
        } else if (type.type === TypeEnum.BASIC) {
          assignCodes.push(`this.${property} = args.${property};`);
        } else if (type.type === TypeEnum.BASIC_NEW) {
          assignCodes.push(`this.${property} = args.${property} && new ${type.name}(args.${property});`);
        } else if (type.type === TypeEnum.OUTER) {
          importUrls.push(type.importUrl!);
          assignCodes.push(`this.${property} = args.${property};`);
        }
      }
    }
    // 特异化处理
    if (name.endsWith("Model") && this.properties.has('logics') && !this.properties.has("name")) {
      let enumName = (this.properties.get('logics')?.items?.refSchema as SchemaSchema)?.properties?.get("name")?.enumName;
      if (enumName) {
        return {
          codeText: `export type ${name} = {[key in ${enumName}]?:any} & {`
            + propertyCodes.join('\n') + `}; \n`
            + `export class C${name}{ `
            + propertyCodes.join('\n')
            + `constructor(args:${name}){`
            + assignCodes.join('\n') + '}\n}',
          importUrls
        }
      }
    }
    return {
      codeText: `export interface ${name} {\n`
        + propertyCodes.join('\n') + `}\n`
        + `export class C${name}{ \n`
        + propertyCodes.join('\n')
        + `constructor(args:${name}){`
        + assignCodes.join('\n') + '}\n}\n',
      importUrls
    }
  }
}


export class EnumSchema {
  enums: { code: string, description?: string }[];
  description?: string;

  constructor(enums: { code: string; description?: string }[], description: string) {
    this.enums = enums;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getSchemaDefinition(name: string): ISchemaDefinition {
    return {
      codeText: `export enum ${name}{\n`
        + this.enums.map(item => `/** ${item.description} */\n` + `${item.code} = '${item.code}'`).join(',\n')
        + `\n}`,
      importUrls: []
    }
  }

  getSchemaDescription(): string | undefined {
    return this.description;
  }
}


export interface ITag {
  name: string;
  description: string;
}

export class Tag {
  name: string;
  description: string;
  methods: Method[];

  constructor(arg: ITag) {
    this.name = arg.name;
    this.description = arg.description;
    this.methods = [];
  }
}

export interface IPath {
  [path: string]: IPathMethod;
}

export class Path {
  methods: Map<string, PathMethod> = new Map();

  constructor(arg: IPath) {
    for (let path in arg) {
      this.methods.set(path, new PathMethod(path, arg[path]));
    }
  }

  init(tags: Tag[], schemas: Map<string, SchemaSchema>) {
    for (let [key, value] of this.methods) {
      value.init(tags, schemas);
    }
  }
}

export type IPathMethod = {
  [method: string]: IMethod;
};

export class PathMethod {
  methods: Map<string, Method> = new Map();

  constructor(requestPath: string, arg: IPathMethod) {
    for (let method in arg) {
      this.methods.set(method, new Method(method, requestPath, arg[method]));
    }
  }

  init(tags: Tag[], schemas: Map<string, SchemaSchema>) {
    for (let [key, value] of this.methods) {
      value.init(tags, schemas);
    }
  }
}


export interface IMethod {
  tags?: string[];
  summary?: string;
  operationId: string;
  /** 参数 */
  parameters: IMethodParameter[];
  /** 请求体 */
  requestBody?: IRequestBody;
  /** 响应体 */
  responses?: IResponse;
}

export class Method {
  tags: string[];
  tagsRef: Tag[] = [];
  summary?: string;
  operationId: string;
  parameters?: MethodParameter[];
  requestBody?: PropertyType;
  response?: PropertyType;
  requestMethod: string;
  requestPath: string;

  constructor(requestMethod: string, requestPath: string, arg: IMethod) {
    this.requestMethod = requestMethod;
    this.requestPath = requestPath;
    this.tags = arg.tags || [];
    this.summary = arg.summary;
    this.operationId = arg.operationId;
    this.parameters = arg.parameters?.map(item => new MethodParameter(item));
    this.requestBody = arg.requestBody && new PropertyType(arg.requestBody.content["application/json"].schema);
    this.response = arg?.responses?.["200"]?.content?.["*/*"] && new PropertyType(arg.responses["200"].content["*/*"].schema);
  }

  init(tags: Tag[], schemas: Map<string, SchemaSchema>) {
    this.tagsRef = this.tags.map(tagName => tags.find(tag => tag.name === tagName)).filter(tag => !!tag);
    this.tagsRef.forEach(tag => tag.methods.push(this));
    if (this.requestBody) {
      if (this.requestBody.$ref) {
        this.requestBody.refSchema = schemas.get(this.requestBody.$ref);
      } else if (this.requestBody.items) {
        if (this.requestBody.items.$ref) {
          this.requestBody.items.refSchema = schemas.get(this.requestBody.items.$ref);
        }
      }
    }
    if (this.response) {
      if (this.response.$ref) {
        this.response.refSchema = schemas.get(this.response.$ref);
      } else if (this.response.items) {
        if (this.response.items.$ref) {
          this.response.items.refSchema = schemas.get(this.response.items.$ref);
        }
      }
    }
  }
}

/**
 * 方法参数
 */
export interface IMethodParameter {
  /** 参数名 */
  name: string;
  /** 位置 */
  in: 'path' | 'query';
  /** 是否必填 */
  required: boolean;
  /** 描述 */
  description?: string;
  /** 参数类型 */
  schema: ISchema;
}

export class MethodParameter {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  description?: string;
  schema: SchemaSchema;

  constructor(arg: IMethodParameter) {
    this.name = arg.name;
    this.in = arg.in;
    this.required = arg.required;
    this.description = arg.description;
    this.schema = new SchemaSchema(arg.schema);
  }
}

export interface IRequestBody {
  content: {
    'application/json': {
      schema: ISchema;
    }
  }
}

export interface IResponse {
  [status: string]: {
    description: string;
    content: {
      '*/*': {
        schema: ISchema;
      }
    }
  }
}

export interface IComponents {
  schemas: { [name: string]: ISchema };
}


export interface IOpenApi {
  tags: ITag[];
  paths: IPath;
  components: IComponents;
}

export class OpenApi {
  tags: Tag[];
  paths: Path;
  schemas: Map<string, SchemaSchema>;
  enumSchemas: Map<string, EnumSchema>;

  constructor(arg: IOpenApi) {
    this.tags = arg.tags.map(item => new Tag(item));
    this.paths = new Path(arg.paths);
    this.schemas = new Map();
    this.enumSchemas = new Map();
    for (let key in arg.components.schemas) {
      this.schemas.set(key, new SchemaSchema(arg.components.schemas[key]));
    }
    this.init();
  }

  public getTags() {
    return this.tags;
  }

  private init() {
    for (let value of this.schemas.values()) {
      // schema初始化
      this.refreshSchemaRefDescription(value);
    }
    // 特殊类($$)型精简
    for (let [name, schema] of this.schemas.entries()) {
      if (name.includes('$$')) {
        let schemaName = name.split('$$')[0];
        if (!this.schemas.has(schemaName)) {
          this.schemas.set(schemaName, schema);
        }
      }
    }
    // 枚举处理
    for (let value of this.schemas.values()) {
      for (let schema of value.getEnumSchemas()) {
        this.enumSchemas.set(schema.name, schema.schema);
      }
    }
    // 方法初始化
    for (let method of this.paths.methods.values()) {
      method.init(this.tags, this.schemas);
    }
    for (let value of this.schemas.values()) {
      // schema初始化
      value.initSchema(this.schemas);
    }
    // 移除$$类型
    for (let [name, schema] of this.schemas.entries()) {
      if (name.includes('$$')) {
        this.schemas.delete(name);
      }
    }
  }

  /**
   * 递归schema
   * @param schema
   * @private
   */
  private refreshSchemaRefDescription(schema: SchemaSchema) {
    for (let [key, propertyType] of schema.properties) {
      if (propertyType?.$ref) {
        // 如果有$ref, 则获取对应的schema的描述
        propertyType.description = this.schemas.get(propertyType.$ref)?.getDescription();
      }
    }
  }
}
