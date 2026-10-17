import {canonicalURL} from '../../../lib/model';
export async function POST(req:Request){
 try {const {url}=await req.json() as {url:unknown};const u=new URL(canonicalURL(String(url)));const id=u.searchParams.get('v');
 if(u.hostname!=='www.youtube.com'||!id||!/^[-\w]{11}$/.test(id))return Response.json({error:'Paste a YouTube video URL. Other sources can be entered manually.'},{status:400});
 const res=await fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(u.href),{signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw new Error();const data=await res.json() as {title:string;author_name:string};
 return Response.json({title:data.title,channel:data.author_name,url:u.href});
 }catch{return Response.json({error:'Metadata lookup is unavailable for this video. Enter the title and channel manually.'},{status:422})}
}
