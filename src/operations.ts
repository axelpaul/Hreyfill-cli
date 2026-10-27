import definitions from "./operations.json";
export type JsonSchema = Record<string, unknown>;
export type Operation = {name:string;description:string;effect:"read"|"write"|"auth";method:"GET"|"POST"|"WS";path:string;paramsSchema:JsonSchema;bodySchema?:JsonSchema;responseType?:"json"|"binary"|"stream";authRequired?:boolean;google?:boolean;coverage?:string;requestModel?:string|null;source?:string};
export const OPERATIONS = definitions as Operation[];
