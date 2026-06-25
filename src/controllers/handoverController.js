/**
 * Handover controller — thin HTTP layer. Parses the request, calls the pipeline service
 * (decorated onto the app as `handoverService`), and returns HTML or JSON. No domain
 * logic lives here.
 *
 * Content negotiation:
 *   - ?format=json / ?format=html always wins.
 *   - else Accept: application/json -> JSON; otherwise HTML (browsers, default curl).
 */

function wantsJson(req) {
  const fmt = req.query.format;
  if (fmt === 'json') return true;
  if (fmt === 'html') return false;
  const accept = req.headers.accept || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

/** Fastify plugin. Registered with the handover service available as app.handoverService. */
export async function handoverRoutes(app) {
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/', async (req, reply) => reply.redirect('/handover'));

  app.get('/handover', async (req, reply) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const handover = await app.handoverService.generate({ date });

    if (wantsJson(req)) {
      reply.type('application/json');
      return handover;
    }
    return reply.view('handover.ejs', { h: handover });
  });
}
