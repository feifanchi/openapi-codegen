import {fetchOpenApi, generateDomainCode, generateMarkdown} from "./codegen/codegen.js";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {Vue3AxiosService} from "./codegen/lang/vue3-lang.js";
import prettier from "prettier";
import * as prettierPluginTypescript from "prettier/parser-typescript";
import prettierPluginEstree from "prettier/plugins/estree";
// 同步读取
const data = readFileSync('./openapi-config.json', 'utf8');
const config = JSON.parse(data);
// markdown文件
const markdowns: string[] = [];
const outdir: string = config["outdir"];
const lang: string = config["lang"];
const prettierConf: any = config["config"];
mkdirSync(outdir, {recursive: true});
for (const group of (config["groups"] as string[])) {
    const groupName = group.split('/').pop();
    mkdirSync(`${outdir}/${groupName}`, {recursive: true});
    const openApi = await fetchOpenApi(group);
    // markdown
    markdowns.push(`# ${groupName}\n`);
    markdowns.push(generateMarkdown(openApi));
    // domain.ts文件
    const domainCode = generateDomainCode(openApi);
    writeFileSync(`${outdir}/${groupName}/${groupName}-domain.ts`, await format(domainCode, prettierConf));
    // service
    let service;
    if (lang === "vue3axios") {
        service = new Vue3AxiosService();
    } else {
        throw new Error(`${lang} not support`);
    }
    for (let tag of openApi.tags.sort((a, b) => a.description.localeCompare(b.description))) {
        writeFileSync(`${outdir}/${groupName}/${tag.description}Service.ts`, await format(
            service.generateService(`./${groupName}-domain`, tag), prettierConf));
    }

}
writeFileSync(`${outdir}/openapi.md`, markdowns.join('\n'));


async function format(text: string, config: any) {
    return await prettier.format(text, {
        parser: 'typescript',
        // @ts-ignore
        plugins: [prettierPluginTypescript, prettierPluginEstree],
        ...config
    });
}
