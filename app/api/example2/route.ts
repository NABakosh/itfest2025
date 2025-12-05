import { NextResponse } from 'next/server'

export async function POST(req: Request) {
	const body = await req.json() // { text: "..." }

	return NextResponse.json({
		status: 'ok',
		received: body,
		message: 'POST endpoint working',
	})
}


// usage 
// const res = await fetch('/api/example', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ text: "hello AI" })
// })

// const data = await res.json();


// example for ai
// const res = await fetch('/api/example', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ text: "hello AI" })
// })

// const data = await res.json();
