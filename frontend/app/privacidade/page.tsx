export default function PrivacidadePage() {
  return (
    <main className="max-w-2xl mx-auto min-h-screen p-6">
      <h1 className="font-bebas text-4xl mb-2">Privacidade</h1>
      <p className="text-xs text-[#B3A9C2] mb-6">Última atualização: 22/09/2026 · Em conformidade com a LGPD (Lei nº 13.709/2018)</p>
      <div className="space-y-4 text-sm text-[#F5F3F8] leading-relaxed">
        <section>
          <h2 className="font-bold mb-1">1. Dados que coletamos</h2>
          <p className="text-[#B3A9C2]">Nome, email e senha (com hash) no cadastro; progresso de aulas, matrículas, pagamentos e certificados durante o uso. O aceite dos termos é registrado com data e hora.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">2. Para que usamos</h2>
          <p className="text-[#B3A9C2]">Liberar acesso aos cursos pagos (via webhooks dos gateways), acompanhar seu progresso, emitir certificados e enviar emails transacionais (boas-vindas, recuperação de senha).</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">3. Compartilhamento</h2>
          <p className="text-[#B3A9C2]">Stripe e Mercado Pago (pagamentos) e Mux/Bunny (streaming de vídeo). Nenhum dado é vendido.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">4. Seus direitos (LGPD, art. 18)</h2>
          <p className="text-[#B3A9C2]">Acesso, correção e eliminação dos seus dados a qualquer momento. A exclusão é feita em <strong>Perfil → Excluir minha conta</strong>: anonimizamos seu cadastro, apagamos progresso e tokens e cancelamos matrículas e assinaturas. Registros de pagamento são mantidos anonimizados por obrigação fiscal.</p>
        </section>
        <section>
          <h2 className="font-bold mb-1">5. Segurança</h2>
          <p className="text-[#B3A9C2]">Senhas com hash bcrypt, vídeos com URL assinada de curta duração, webhooks com validação de assinatura e rate limiting na API.</p>
        </section>
      </div>
    </main>
  );
}
