import {IOpenApi, OpenApi, TypeEnum} from './domain.js';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';


export async function fetchOpenApi(url: string): Promise<OpenApi> {
  let response = await fetch(url);
  let res = (await response.json()) as IOpenApi;
  return new OpenApi(res);
}

export function generateMarkdown(openApi: OpenApi): [string, string] {
  // markdown
  let markdownsWithExample: string[] = [];
  let markdownsWithoutExample: string[] = [];
  for (let tag of openApi.tags.sort((a, b) => a.description.localeCompare(b.description))) {
    // 服务名
    markdownsWithExample.push(`## ${tag.name} ${tag.description}Service\n`)
    markdownsWithoutExample.push(`## ${tag.name} ${tag.description}Service\n`)
    // 方法
    for (let method of tag.methods.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      // 方法名
      markdownsWithExample.push(`### ${method.summary} ${method.operationId}\n`)
      markdownsWithoutExample.push(`### ${method.summary} ${method.operationId}\n`)
      // 请求地址
      markdownsWithExample.push(`**请求地址:** ${method.requestPath}\n`);
      markdownsWithoutExample.push(`**请求地址:** ${method.requestPath}\n`);
      // 请求方式
      markdownsWithExample.push(`**请求方式:** ${method.requestMethod}\n`);
      markdownsWithoutExample.push(`**请求方式:** ${method.requestMethod}\n`);
      if (method.parameters && method.parameters.length > 0) {
        // 请求参数
        markdownsWithExample.push(`**请求参数**\n`);
        markdownsWithExample.push(`| 参数名 | 请求类型 | 数据类型 | 描述 | 是否必填 |`);
        markdownsWithExample.push(`| --- | --- | --- | --- | --- |`);
        markdownsWithoutExample.push(`**请求参数**\n`);
        markdownsWithoutExample.push(`| 参数名 | 请求类型 | 数据类型 | 描述 | 是否必填 |`);
        markdownsWithoutExample.push(`| --- | --- | --- | --- | --- |`);
        for (let parameter of method.parameters) {
          const type = parameter.schema.getTypescriptType().name;
          markdownsWithExample.push(`| ${parameter.name} | ${parameter.in} | ${type} | ${parameter.description || ''} | ${parameter.required} |`);
          markdownsWithoutExample.push(`| ${parameter.name} | ${parameter.in} | ${type} | ${parameter.description || ''} | ${parameter.required} |`);
        }
        markdownsWithExample.push('\n');
        markdownsWithoutExample.push('\n');
      }
      if (method.requestBody) {
        const type = method.requestBody.getTypescriptType();
        markdownsWithExample.push(`**请求体** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        markdownsWithoutExample.push(`**请求体** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        if (type.type === TypeEnum.INNER) {
          markdownsWithExample.push(`| 参数名 | 描述 | 是否必填 | 长度 | 数据类型 |`);
          markdownsWithExample.push(`| --- | --- | --- | --- | --- |`);
          markdownsWithoutExample.push(`| 参数名 | 描述 | 是否必填 | 长度 | 数据类型 |`);
          markdownsWithoutExample.push(`| --- | --- | --- | --- | --- |`);
          const schema = openApi.schemas.get(type.name);
          let metas = schema!.getSchemaPropertyMetas(0);
          for (let meta of metas) {
            markdownsWithExample.push(`| ${'&nbsp;'.repeat(meta.level * 2)}${meta.name} | ${meta.description || ''} | ${meta.require}  | ${meta.maxLength || ''} | ${meta.type.name}${'[]'.repeat(meta.type.arrayLevel)} |`)
            markdownsWithoutExample.push(`| ${'&nbsp;'.repeat(meta.level * 2)}${meta.name} | ${meta.description || ''} | ${meta.require}  | ${meta.maxLength || ''} | ${meta.type.name}${'[]'.repeat(meta.type.arrayLevel)} |`)
          }
          markdownsWithExample.push('\n');
          markdownsWithoutExample.push('\n');
        }
        markdownsWithExample.push("```json\n" + JSON.stringify(method.requestBody.getExample(), null, 2) + "\n```");
        markdownsWithExample.push('\n');
        markdownsWithoutExample.push('\n');
      }
      if (method.response) {
        const type = method.response.getTypescriptType();
        markdownsWithExample.push(`**返回** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        markdownsWithoutExample.push(`**返回** ${type.name}${'[]'.repeat(type.arrayLevel)}\n`);
        if (type.type === TypeEnum.INNER) {
          markdownsWithExample.push(`| 参数名 | 描述 | 数据类型 |`);
          markdownsWithExample.push(`| --- | --- | --- |`);
          markdownsWithoutExample.push(`| 参数名 | 描述 | 数据类型 |`);
          markdownsWithoutExample.push(`| --- | --- | --- |`);
          const schema = openApi.schemas.get(type.name);
          let metas = schema!.getSchemaPropertyMetas(0);
          for (let meta of metas) {
            markdownsWithExample.push(`| ${'&nbsp;'.repeat(meta.level * 4)}${meta.name} | ${meta.description || ''} | ${rehandleAggregation(meta.type.name)}${'[]'.repeat(meta.type.arrayLevel)} |`)
            markdownsWithoutExample.push(`| ${'&nbsp;'.repeat(meta.level * 4)}${meta.name} | ${meta.description || ''} | ${rehandleAggregation(meta.type.name)}${'[]'.repeat(meta.type.arrayLevel)} |`)
          }
          markdownsWithExample.push('\n');
          markdownsWithoutExample.push('\n');
        }
        markdownsWithExample.push("```json\n" + JSON.stringify(method.response.getExample(), null, 2) + "\n```");
        markdownsWithExample.push('\n');
        markdownsWithoutExample.push('\n');
      }
    }
  }
  return [markdownsWithExample.join('\n'), markdownsWithoutExample.join('\n')];
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


