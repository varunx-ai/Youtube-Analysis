import type {ResearchVideo} from "./types";

export type RelevanceDecision={video:ResearchVideo;score:number;status:"relevant"|"excluded";reasons:string[]};
const endurance=["run","runner","running","marathon","half marathon","10k","5k","ultra","trail run","jog","race day","running shoe","training plan","long run","tempo run","easy run","interval","ironman","triathlon"];
const india=["india","indian","bengaluru","bangalore","mumbai","delhi","hyderabad","chennai","kolkata","pune","ladakh","goa","gurugram","gurgaon","noida","jaipur","ahmedabad"];
const obviousNoise=["minecraft","gaming","gameplay","twitch","movie marathon","anime marathon","study marathon","coding marathon","hackathon","livestream marathon","stream marathon"];
const trackOnly=["4x400","relay","sprinter","sprint","100m","200m","400m","athletics highlights","asian games","national champion"];
const norm=(s:string)=>` ${s.toLowerCase().replace(/[^a-z0-9]+/g," ")} `;
const has=(text:string,terms:string[])=>terms.some(x=>text.includes(` ${x} `)||text.includes(x));
export function assessMarketRelevance(v:ResearchVideo):RelevanceDecision{
 const title=norm(v.title),body=norm(`${v.title} ${v.description||""} ${(v.tags||[]).join(" ")} ${v.channelTitle}`);let score=0;const reasons:string[]=[];
 if(has(title,obviousNoise)||has(body,obviousNoise)){score-=100;reasons.push("non-running use of marathon/running keyword")}
 if(has(body,endurance)){score+=45;reasons.push("endurance-running context")}
 if(has(title,endurance)){score+=25;reasons.push("running intent in title")}
 if(has(body,india)){score+=20;reasons.push("India/local context")}
 if(has(title,trackOnly)&&!has(body,["distance running","road running","marathon training","half marathon","10k","5k","running tips","running shoe"])){score-=45;reasons.push("track/sprint result rather than endurance-running content")}
 if((v.durationSec||0)>=120)score+=5;
 return {video:v,score,status:score>=35?"relevant":"excluded",reasons};
}
export function filterMarketRelevant(videos:ResearchVideo[]){const decisions=videos.map(assessMarketRelevance);return {relevant:decisions.filter(x=>x.status==="relevant").map(x=>x.video),excluded:decisions.filter(x=>x.status==="excluded")};}
