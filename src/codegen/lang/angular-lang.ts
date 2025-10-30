// service


import {SchemaSchema, Tag, TPropertyType, TypeEnum} from "../domain.js";

export class AngularLang {
  generateService(domainPath: string, tag: Tag): string {
    const rets: string[] = [];
    // imports
    rets.push(`import {HttpClient} from '@angular/common/http';\n`)
    rets.push(`import {Observable} from 'rxjs/internal/Observable';\n`)
    rets.push(`import {Injectable} from '@angular/core';\n`)
    rets.push(`import {map} from 'rxjs';\n`)
    rets.push('type AddNullIncludingArrayElements<T> = T extends (infer U)[] ? (AddNullIncludingArrayElements<U> | null)[] : T extends object ? { [K in keyof T]: AddNullIncludingArrayElements<T[K]> | null } : T | null;\n');
    const imports: Set<string> = new Set<string>();
    const importInners: Set<string> = new Set<string>();
    // serice
    rets.push(`/** ${tag.name} */\n`);
    rets.push(`@Injectable({providedIn: 'root'})\n`);
    rets.push(`export class ${tag.description}Service { constructor(private httpClient:HttpClient){}`);
    for (let method of tag.methods.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
      rets.push(`/** ${method.summary} */\n`)
      rets.push(`${method.operationId}(`)
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
        params.push(`data:AddNullIncludingArrayElements<${type.name}>${'[]'.repeat(type.arrayLevel)}`);
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
        rets.push(`):Observable<${type.name}${'[]'.repeat(type.arrayLevel)}>{`);
      } else {
        rets.push(`):Observable<void>{`);
      }
      // 方法体
      const path = method.requestPath.replaceAll('{', '${');
      if (method.response) {
        const type = method.response.getTypescriptType();
        rets.push(`return this.httpClient.${method.requestMethod}<${type.name}${'[]'.repeat(type.arrayLevel)}>(` + '`' + path + '`' + ``);
      } else {
        rets.push(`return this.httpClient.${method.requestMethod}<void>(` + '`' + path + '`' + ``);
      }
      if (bodyFlag) {
        rets.push(`,data`)
      } else if (method.requestMethod !== 'get' && method.requestMethod !== 'head' && method.requestMethod !== 'delete' && method.requestMethod !== 'options') {
        rets.push(`,{}`)
      }
      if (queryParamFlag) {
        rets.push(`,{params}`)
      }
      rets.push(`)`);
      if (method.response) {
        // 返回值
        rets.push(`.pipe(map(`);
        const type = method.response.getTypescriptType();
        importInners.add(type.name);
        if (type.type === TypeEnum.INNER) {
          importInners.add('C' + type.name);
        }
        rets.push(this.getResponseHandler(type.arrayLevel, type));
        rets.push(`))\n`)
      }
      rets.push(`;}`);
    }
    rets.push(`}`);
    return ['import {' + [...importInners.keys()].join(',') + `} from '${domainPath}';`
      , ...imports.keys()
      , ...rets].join(' ');
  }

  private getResponseHandler(level: number, type: TPropertyType): string {
    if (level > 0) {
      return `res${level}=>res${level} && res${level}.map(` + this.getResponseHandler(level - 1, type) + ')';
    }
    if (type.type === TypeEnum.BASIC_NEW || type.type === TypeEnum.OUTER_NEW) {
      return `res0 => res0 && new ${type.name}(res0)`
    } else if (type.type === TypeEnum.INNER) {
      return `res0 => res0 && new C${type.name}(res0)`
    } else if (type.type === TypeEnum.ENUM) {
      return `res0 => res0 as ${type.name}`
    }
    return `res0 => res0`;
  }
}

