import {NextResponse} from "next/server";import {geminiConfig} from "../../../../lib/video-intelligence";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(geminiConfig())}
