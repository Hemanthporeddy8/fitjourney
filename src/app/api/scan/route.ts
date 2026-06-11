import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body; // Base64 image data url
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Call local FastAPI food AI VLM server
    const response = await fetch('http://127.0.0.1:8000/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_base64: image }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ScanAPI] FastAPI returned error:', errorText);
      return NextResponse.json(
        { error: `FastAPI server error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[ScanAPI] Handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to communicate with VLM backend server' },
      { status: 500 }
    );
  }
}
