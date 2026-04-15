const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function includeConversation(currentUserId) {
  return {
    listing: { select: { id: true, title: true, price: true, city: true, images: { orderBy: { sortOrder: 'asc' } } } },
    buyer: { select: { id: true, name: true, storeName: true } },
    seller: { select: { id: true, name: true, storeName: true, storeLogoUrl: true } },
    messages: {
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true } } }
    },
    _count: {
      select: {
        messages: currentUserId ? { where: { senderId: { not: currentUserId }, readAt: null } } : true,
      }
    }
  };
}

async function assertParticipant(conversationId, userId) {
  const convo = await prisma.conversation.findUnique({ where: { id: Number(conversationId) } });
  if (!convo) return { error: 'Conversa não encontrada.', status: 404 };
  if (![convo.buyerId, convo.sellerId].includes(userId)) return { error: 'Sem permissão para esta conversa.', status: 403 };
  return { convo };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
      include: includeConversation(req.user.id),
      orderBy: { updatedAt: 'desc' }
    });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar conversas.' });
  }
});

router.post('/start', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.body.listingId);
    const initialMessage = String(req.body.message || '').trim();
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { user: true } });
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (listing.userId === req.user.id) return res.status(400).json({ message: 'Você não pode iniciar chat no próprio anúncio.' });

    let conversation = await prisma.conversation.findUnique({
      where: { listingId_buyerId_sellerId: { listingId, buyerId: req.user.id, sellerId: listing.userId } },
      include: includeConversation(req.user.id)
    }).catch(() => null);

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          listingId,
          buyerId: req.user.id,
          sellerId: listing.userId,
          messages: {
            create: [{
              senderId: req.user.id,
              content: initialMessage || `Olá! Tenho interesse no veículo ${listing.title}. Ainda está disponível?`
            }]
          }
        },
        include: includeConversation(req.user.id)
      });
    }

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao iniciar conversa.' });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  const checked = await assertParticipant(req.params.id, req.user.id);
  if (checked.error) return res.status(checked.status).json({ message: checked.error });
  const conversation = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) }, include: includeConversation(req.user.id) });
  await prisma.chatMessage.updateMany({ where: { conversationId: Number(req.params.id), senderId: { not: req.user.id }, readAt: null }, data: { readAt: new Date() } });
  res.json(conversation);
});

router.post('/:id/messages', authRequired, async (req, res) => {
  try {
    const checked = await assertParticipant(req.params.id, req.user.id);
    if (checked.error) return res.status(checked.status).json({ message: checked.error });
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ message: 'Digite uma mensagem.' });
    await prisma.chatMessage.create({ data: { conversationId: Number(req.params.id), senderId: req.user.id, content } });
    await prisma.conversation.update({ where: { id: Number(req.params.id) }, data: { updatedAt: new Date() } });
    const conversation = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) }, include: includeConversation(req.user.id) });
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao enviar mensagem.' });
  }
});

module.exports = router;
