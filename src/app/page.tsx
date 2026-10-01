import Link from 'next/link';
import {
  CalendarDays,
  Truck,
  AlertCircle,
  CheckCircle2,
  MapPin,
  HelpCircle,
  Lock,
  Clock
} from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      {/* Hero Header */}
      <header className={styles.hero}>
        <div className={styles.badge}>
          <MapPin className={styles.badgeIcon} />
          <span>Programa Oficial de Endereçamento</span>
        </div>
        <h1 className={styles.title}>
          Rio Branco do Sul <span className={styles.titleHighlight}>tem endereço</span>
        </h1>
        <p className={styles.subtitle}>
          Estamos organizando e instalando a numeração predial oficial de todas as residências.
          Confira abaixo como funciona o processo de atendimento no seu bairro.
        </p>
      </header>

      {/* Main Notice Banner */}
      <section className={styles.noticeBanner}>
        <Clock className={styles.noticeBannerIcon} />
        <div className={styles.noticeBannerContent}>
          <h2>Atendimento Programado nas Ruas</h2>
          <p>
            As equipes de instalação percorrem as ruas de forma contínua e planejada.
            O morador não precisa realizar nenhum cadastro prévio nem pagar nada pelo serviço — basta aguardar a passagem da equipe pela sua localidade.
          </p>
        </div>
      </section>

      {/* Information Cards Grid */}
      <section className={styles.sectionHeading}>
        <h3>Como funciona o atendimento</h3>
        <p>Entenda cada etapa e saiba o que fazer em cada situação</p>
      </section>

      <section className={styles.grid}>
        {/* Card 1: Cronograma */}
        <div className={styles.card}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperGreen}`}>
            <CalendarDays size={24} />
          </div>
          <div className={styles.cardBody}>
            <h4 className={styles.cardTitle}>1. Conforme Cronograma</h4>
            <p className={styles.cardDescription}>
              As instalações ocorrem rigorosamente de acordo com o cronograma estabelecido por bairros e setores. Toda a cidade será atendida pelas equipes de campo.
            </p>
          </div>
        </div>

        {/* Card 2: Notificação na Rua */}
        <div className={styles.card}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperBlue}`}>
            <Truck size={24} />
          </div>
          <div className={styles.cardBody}>
            <h4 className={styles.cardTitle}>2. Recebeu a Notificação?</h4>
            <p className={styles.cardDescription}>
              Se você recebeu o comunicado ou aviso em sua casa, fique tranquilo: sua região já entrou na rota de atendimento e muito em breve a equipe passará instalando os números na sua rua.
            </p>
          </div>
        </div>

        {/* Card 3: Vizinhos instalados e você não */}
        <div className={`${styles.card} ${styles.cardHighlight}`}>
          <div className={`${styles.iconWrapper} ${styles.iconWrapperAmber}`}>
            <AlertCircle size={24} />
          </div>
          <div className={styles.cardBody}>
            <h4 className={styles.cardTitle}>3. Ficou sem placa?</h4>
            <p className={styles.cardDescription}>
              Se você percebeu que os números já foram instalados nos seus vizinhos e na sua residência ainda não, entre em contato com a prefeitura para agendar sua instalação.
            </p>
          </div>
          <div className={styles.contactNote}>
            Entre em contato com a prefeitura para solicitar o agendamento da sua residência.
          </div>
        </div>
      </section>

      {/* Quick FAQ / Guidelines */}
      <section className={styles.faqSection}>
        <div className={styles.faqHeader}>
          <HelpCircle className={styles.faqHeaderIcon} />
          <h4>Orientações Importantes</h4>
        </div>
        <div className={styles.faqList}>
          <div className={styles.faqItem}>
            <div className={styles.faqQuestion}>
              <CheckCircle2 className={styles.checkIcon} />
              <span>Onde o número é fixado?</span>
            </div>
            <p className={styles.faqAnswer}>
              A placa é instalada na parte frontal externa do imóvel (muro, portão ou fachada visível da via pública).
            </p>
          </div>

          <div className={styles.faqItem}>
            <div className={styles.faqQuestion}>
              <CheckCircle2 className={styles.checkIcon} />
              <span>Preciso estar em casa?</span>
            </div>
            <p className={styles.faqAnswer}>
              Não é obrigatório, desde que haja acesso seguro e livre à fachada frontal para a equipe realizar a fixação.
            </p>
          </div>

          <div className={styles.faqItem}>
            <div className={styles.faqQuestion}>
              <CheckCircle2 className={styles.checkIcon} />
              <span>Existe cobrança?</span>
            </div>
            <p className={styles.faqAnswer}>
              Não. O serviço e as placas são 100% gratuitos para os moradores.
            </p>
          </div>

          <div className={styles.faqItem}>
            <div className={styles.faqQuestion}>
              <CheckCircle2 className={styles.checkIcon} />
              <span>E se não for possível instalar por falta de acesso?</span>
            </div>
            <p className={styles.faqAnswer}>
              Em caso de não ser possível instalar o número em sua residência por falta de acesso (como portão fechado ou impossibilidade de fixação externa), entre em contato com a prefeitura para agendar o atendimento.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          Sistema de Gestão de Endereçamento &bull; Rio Branco do Sul
        </span>
        <Link href="/login" className={styles.loginLink}>
          <Lock className={styles.lockIcon} />
          <span>Acesso Restrito</span>
        </Link>
      </footer>
    </main>
  );
}
