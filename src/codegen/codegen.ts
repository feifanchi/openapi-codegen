import {IOpenApi, OpenApi, TypeEnum} from './domain.js';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';


export async function fetchOpenApi(url: string): Promise<OpenApi> {
  let response = await fetch(url);
  let res = (await response.json()) as IOpenApi;
  return new OpenApi(res);
}

export function generateMarkdown(openApi: OpenApi) {
  // markdown
  let markdowns: string[] = [];
  for (let tag of openApi.tags.sort((a, b) => a.description.localeCompare(b.description))) {
    // 服务名
    markdowns.push(`## ${tag.name} ${tag.description}Service\n`)
    // 方法
    for (let method of tag.methods.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      // 方法名
      markdowns.push(`### ${method.summary} ${method.operationId}\n`)
      // 请求地址
      markdowns.push(`**请求地址:** ${method.requestPath}\n`);
      // 请求方式
      markdowns.push(`**请求方式:** ${method.requestMethod}\n`);
      if (method.parameters && method.parameters.length > 0) {
        // 请求参数
        markdowns.push(`**请求参数**\n`);
        markdowns.push(`| 参数名 | 请求类型 | 数据类型 | 描述 | 是否必填 |`);
        markdowns.push(`| --- | --- | --- | --- | --- |`);
        for (let parameter of method.parameters) {
          const type = parameter.schema.getTypescriptType().name;
          markdowns.push(`| ${parameter.name} | ${parameter.in} | ${type} | ${parameter.description || ''} | ${parameter.required} |`);
        }
        markdowns.push('\n');
      }
      if (method.requestBody) {
        const type = method.requestBody.getTypescriptType();
        markdowns.push(`**请求体** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        if (type.type === TypeEnum.INNER) {
          markdowns.push(`| 参数名 | 描述 | 是否必填 | 数据类型 |`);
          markdowns.push(`| --- | --- | --- | --- |`);
          const schema = openApi.schemas.get(type.name);
          let metas = schema!.getSchemaPropertyMetas(0);
          for (let meta of metas) {
            markdowns.push(`| ${'&nbsp;'.repeat(meta.level * 2)}${meta.name} | ${meta.description || ''} | ${meta.require} | ${meta.type.name}${'[]'.repeat(meta.type.arrayLevel)} |`)
          }
          markdowns.push('\n');
        }
        markdowns.push("```json\n" + JSON.stringify(method.requestBody.getExample(), null, 2) + "\n```");
        markdowns.push('\n');
      }
      if (method.response) {
        const type = method.response.getTypescriptType();
        markdowns.push(`**返回** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        if (type.type === TypeEnum.INNER) {
          markdowns.push(`| 参数名 | 描述 | 数据类型 |`);
          markdowns.push(`| --- | --- | --- |`);
          const schema = openApi.schemas.get(type.name);
          let metas = schema!.getSchemaPropertyMetas(0);
          for (let meta of metas) {
            markdowns.push(`| ${'&nbsp;'.repeat(meta.level * 4)}${meta.name} | ${meta.description || ''} | ${rehandleAggregation(meta.type.name)}${'[]'.repeat(meta.type.arrayLevel)} |`)
          }
          markdowns.push('\n');
        }
        markdowns.push("```json\n" + JSON.stringify(method.response.getExample(), null, 2) + "\n```");
        markdowns.push('\n');
      }
    }
  }
  return markdowns.join('\n');
}

function rehandleAggregation(type: string): string {
  if (type.includes("Aggregation$")) {
    // 删除 Aggregation$后内容
    return type.split("$")[0];
  }
  return type;
}

export function generateDomainCode(openApi: OpenApi) {
  let imports: Set<string> = new Set<string>();
  let codeTexts: string[] = [];
  for (let [key, schema] of openApi.schemas) {
    let definition = schema.getSchemaDefinition(key);
    for (let url of definition.importUrls) {
      imports.add(url);
    }
    codeTexts.push(definition.codeText);
  }
  for (let [key, schema] of openApi.enumSchemas) {
    let definition = schema.getSchemaDefinition(key);
    codeTexts.push(definition.codeText);
  }
  // return text;
  return `${[...imports].join('\n')}\n${codeTexts.join('\n')}`;
}

export function generateServiceMd5Code(openApi: OpenApi) {
  const rets: string[] = [];
  for (let tag of openApi.tags) {
    rets.push(`/** ${tag.name} */\n`)
    rets.push(`export enum ${tag.description}Md5Code {`);
    for (let method of tag.methods) {
      // /api/business/authorization/interfaces/search/list
      const md5Code = CryptoJS.MD5(method.requestMethod.toUpperCase() + reorderPathSegments(method.requestPath)).toString()
        .substring(8, 24).toLowerCase();
      rets.push(`\n/** ${method.summary} */\n`);
      rets.push(`${method.operationId} = '${md5Code}',`);
    }
    rets.push(`}\n`);
  }
  return rets.join(' ');
}

function reorderPathSegments(path: string): string {
  const segments = path.split('/').filter(segment => segment.length > 0).map(segment => {
    return segment.startsWith('{') ? '*' : segment;
  });
  if (segments.length >= 3 && segments[0] === 'api') {
    const [, second, third, ...rest] = segments;
    return '/' + [third, second, ...rest].join('/');
  }

  return path;
}


