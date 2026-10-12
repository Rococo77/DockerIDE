/// <reference types="vite/client" />
// Monaco is bundled with the app instead of being fetched from cdn.jsdelivr.net, the
// default of @monaco-editor/react: the editor must work offline and on school networks
// that filter CDNs, like the rest of the IDE.
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
// Workers, by the paths monaco-editor's package "exports" give them (esm/vs/...)
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
        switch (label) {
            case 'json':
                return new JsonWorker();
            case 'css':
            case 'scss':
            case 'less':
                return new CssWorker();
            case 'html':
            case 'handlebars':
            case 'razor':
                return new HtmlWorker();
            case 'typescript':
            case 'javascript':
                return new TsWorker();
            default:
                return new EditorWorker();
        }
    },
};

loader.config({ monaco });
