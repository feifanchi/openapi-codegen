// service


import {SchemaSchema, Tag, TypeEnum} from "../domain.js";

export class Vue3AxiosService {
  generateService(domainPath: string, tag: Tag): string {
    const rets: string[] = [];
    // imports
    rets.push(`import service from "../service.js";\n`)
    const imports: Set<string> = new Set<string>();
    const importInnerClasses: Set<string> = new Set<string>();
    const importInners: Set<string> = new Set<string>();
    // serice
    rets.push(`/** ${tag.name} */\n`)
    rets.push(`export class ${tag.description}Service {`);
    for (let method of tag.methods.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      rets.push(`/** ${method.summary} */\n`)
      rets.push(`static ${method.operationId}(`)
      let queryParamFlag = false;
      let bodyFlag = false;
      // 参数
      const params: string[] = [];
      // 路径参数
      const paths = method.parameters?.filter(p => p.in === 'path');
      if (paths && paths.length > 0) {
        for (let path of paths) {
          const t = (path.schema as SchemaSchema).getTypescriptType();
          params.push(`${path.name}:${t.name}`)
        }
      }
      // 请求体
      if (method.requestBody) {
        bodyFlag = true;
        const type = method.requestBody.getTypescriptType();
        if (type.type === TypeEnum.INNER || type.type === TypeEnum.ENUM) {
          importInners.add(type.name);
        } else if (type.type === TypeEnum.OUTER || type.type === TypeEnum.OUTER_NEW) {
          imports.add(type.importUrl!);
        }
        params.push(`data:${type.name}${'[]'.repeat(type.arrayLevel)}`);
      }
      // 查询参数
      const queries = method.parameters?.filter(p => p.in === 'query');
      const queryParms: string[] = [];
      if (queries && queries.length > 0) {
        queryParamFlag = true;
        queryParms.push(`params:{`)
        for (let query of queries) {
          const t = (query.schema as SchemaSchema).getTypescriptType();
          queryParms.push(`${query.name}:${t.name}${'[]'.repeat(t.arrayLevel)},`)
        }
        queryParms.push(`}`);
        params.push(queryParms.join(''));
      }
      rets.push(params.join(','));
      // 返回值
      if (method.response) {
        const type = method.response.getTypescriptType();
        rets.push(`):Promise<${type.name}${'[]'.repeat(type.arrayLevel)}>{`);
      } else {
        rets.push(`):Promise<void>{`);
      }
      // 方法体
      const path = method.requestPath.replaceAll('{', '${');
      if (method.response) {
        const type = method.response.getTypescriptType();
        rets.push(`return service.${method.requestMethod}<${type.name}${'[]'.repeat(type.arrayLevel)}>(` + '`' + path + '`' + ``);
      } else {
        rets.push(`return service.${method.requestMethod}<void>(` + '`' + path + '`' + ``);
      }
      if (queryParamFlag || bodyFlag) {
        rets.push(`,{`)
        if (queryParamFlag) {
          rets.push(`params,`)
        }
        if (bodyFlag) {
          rets.push(`data,`)
        }
        rets.push(`}`)
      }
      rets.push(`)`);
      // 返回值
      rets.push(`.then(res=>res.data)`);
      if (method.response) {
        const type = method.response.getTypescriptType();
        if (type.type === TypeEnum.INNER || type.type === TypeEnum.ENUM) {
          importInners.add(type.name);
          importInnerClasses.add('C' + type.name);
        } else if (type.type === TypeEnum.OUTER || type.type === TypeEnum.OUTER_NEW) {
          imports.add(type.importUrl!);
        }
        if (type.arrayLevel) {
          let itemArray = ".map(item0 =>";
          for (let i = 1; i < type.arrayLevel; i++) {
            itemArray = itemArray + `item${i - 1}.map(item${i} =>`;
          }
          if (type.type === TypeEnum.BASIC_NEW || type.type === TypeEnum.OUTER_NEW) {
            rets.push(`.then(res=>res?${itemArray} new ${type.name}(item${type.arrayLevel - 1})${')'.repeat(type.arrayLevel)};`);
          } else if (type.type === TypeEnum.INNER) {
            rets.push(`.then(res=>res?${itemArray} new C${type.name}(item${type.arrayLevel - 1})${')'.repeat(type.arrayLevel)});`);
          } else if (type.type === TypeEnum.ENUM) {
            rets.push(`.then(res=>res?${itemArray} item${type.arrayLevel - 1} as ${type.name} ${')'.repeat(type.arrayLevel)};`);
          }
        } else {
          if (type.type === TypeEnum.BASIC_NEW || type.type === TypeEnum.OUTER_NEW) {
            rets.push(`.then(res=> new ${type.name}(res));`);
          } else if (type.type === TypeEnum.INNER) {
            rets.push(`.then(res=> new C${type.name}(res));`);
          } else if (type.type === TypeEnum.ENUM) {
            rets.push(`.then(res=> res as ${type.name});`);
          }
        }
      }
      rets.push(`}\n`)
    }
    rets.push(`}`);
    return ['import type {' + [...importInners.keys()].join(',') + `} from '${domainPath}';`,
      'import {' + [...importInnerClasses.keys()].join(',') + `} from '${domainPath}';`,
      ...imports.keys(),
      ...rets].join(' ');
  }
}

