// Netlify Function — Webhook Kiwify → Netlify Identity
// Recebe a notificação de compra aprovada e envia convite automático ao aluno

exports.handler = async (event) => {
  // Aceita apenas POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // ── Verifica token de segurança da Kiwify ──────────────────────────────────
  // A Kiwify envia ?token=SEU_TOKEN na query string do webhook
  // Configure esse token no painel da Kiwify e copie o mesmo valor em:
  // Netlify → Site configuration → Environment variables → KIWIFY_TOKEN
  const tokenRecebido = event.queryStringParameters?.token;
  const tokenEsperado = process.env.KIWIFY_TOKEN;

  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    console.error('Token inválido:', tokenRecebido);
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // ── Filtra apenas compras aprovadas ───────────────────────────────────────
  // Kiwify envia order_status: "paid" para compras aprovadas
  const status = payload?.order_status;
  if (status !== 'paid') {
    console.log('Evento ignorado, status:', status);
    return { statusCode: 200, body: 'Ignored' };
  }

  // ── Extrai email do comprador ──────────────────────────────────────────────
  const email = payload?.Customer?.email || payload?.customer?.email;
  if (!email) {
    console.error('Email não encontrado no payload:', JSON.stringify(payload));
    return { statusCode: 400, body: 'Email not found' };
  }

  console.log('Nova compra aprovada, convidando:', email);

  // ── Envia convite via Netlify Identity API ─────────────────────────────────
  // NETLIFY_SITE_ID e NETLIFY_TOKEN são configurados como env vars no Netlify
  const siteId   = process.env.NETLIFY_SITE_ID;
  const apiToken = process.env.NETLIFY_API_TOKEN;

  if (!siteId || !apiToken) {
    console.error('Variáveis de ambiente NETLIFY_SITE_ID ou NETLIFY_API_TOKEN não configuradas');
    return { statusCode: 500, body: 'Server misconfigured' };
  }

  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/identity/users/invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ invites: [{ email }] }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao convidar usuário:', JSON.stringify(data));
      return { statusCode: 500, body: 'Failed to invite user' };
    }

    console.log('Convite enviado com sucesso para:', email);
    return { statusCode: 200, body: 'Invite sent' };

  } catch (err) {
    console.error('Erro na requisição:', err.message);
    return { statusCode: 500, body: 'Request failed' };
  }
};
