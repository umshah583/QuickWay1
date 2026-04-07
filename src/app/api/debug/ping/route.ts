import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Server is reachable!',
    timestamp: new Date().toISOString(),
    userAgent: process.browser ? 'browser' : 'server',
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'POST request received!',
    timestamp: new Date().toISOString(),
  });
}
