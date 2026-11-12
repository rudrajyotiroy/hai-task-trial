import {handle} from '../../api/trials.js';
// Netlify classic function adapter. Keep query strings for health and admin export.
export async function handler(event){
 const method=event.httpMethod||'GET';
 const query=event.rawQuery||new URLSearchParams(event.queryStringParameters||{}).toString();
 const url='https://'+(event.headers?.host||'localhost')+'/api/trials'+(query?'?'+query:'');
 const request=new Request(url,{method,headers:event.headers||{},body:method==='POST'?event.body:undefined});
 const response=await handle(request);
 return {statusCode:response.status,headers:Object.fromEntries(response.headers.entries()),body:await response.text()};
}
