export async function GET() {
  return new Response(
    'google-site-verification: google66c0144803cee571.html',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  );
}
