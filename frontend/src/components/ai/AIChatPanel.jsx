import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Loader2, Send } from 'lucide-react';
import { aiAPI } from '../../services/api';
import BilingualText from '../i18n/BilingualText';

const renderInlineMarkdown = (text) => text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).map((part, index) => {
  const isBold = (part.startsWith('**') && part.endsWith('**'))
    || (part.startsWith('__') && part.endsWith('__'));
  return isBold
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part;
});

function MarkdownMessage({ text }) {
  const lines = String(text || '')
    .replace(/\\([*_#>`-])/g, '$1')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="my-1 list-disc space-y-1 pl-5">
          {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();
    if (!trimmed) return;

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h3 key={`heading-${index}`} className="mt-2 font-semibold">
          {renderInlineMarkdown(heading[1])}
        </h3>
      );
    } else {
      blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
    }
  });
  flushList();

  return <div className="space-y-1">{blocks}</div>;
}

export default function AIChatPanel({ complaintId = null, title = 'Gramamitra AI', compact = false, bilingual = false }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const placeholder = complaintId ? 'Ask about this complaint…' : 'Ask about your complaints…';
  const translate = (english) => t(english, { defaultValue: english, keySeparator: false });
  const Text = ({ english }) => bilingual ? <BilingualText english={english} /> : english;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, isSending]);

  const sendMessage = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setMessage('');
    setError('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setIsSending(true);
    try {
      const { data } = await aiAPI.chat({
        message: text,
        complaint_id: complaintId,
        session_id: sessionId || undefined,
      });
      setSessionId(data.session_id);
      setMessages((current) => [...current, { role: 'assistant', text: data.response }]);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'The AI assistant could not respond.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-light/60 text-brand-ink">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-brand-ink"><Text english={title} /></h2>
          <p className="text-xs text-neutral-muted">
            {complaintId
              ? <Text english="Answers use this complaint’s authorized context." />
              : <Text english="Answers use your authorized dashboard data." />}
          </p>
        </div>
      </div>

      <div
        aria-live="polite"
        className={`mb-4 space-y-3 overflow-y-auto pr-1 ${compact ? 'max-h-64' : 'max-h-80'}`}
      >
        {messages.length === 0 && (
          <p className="rounded-2xl bg-brand-ink/[0.04] px-4 py-3 text-sm text-neutral-muted">
            <Text english="Ask about complaint status, progress, or available report information." />
          </p>
        )}
        {messages.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              item.role === 'user'
                ? 'ml-auto bg-saffron-light/45 text-neutral-text'
                : 'mr-auto bg-brand-ink/5 text-neutral-text'
            }`}
          >
            {item.role === 'assistant'
              ? <MarkdownMessage text={item.text} />
              : <p className="whitespace-pre-wrap">{item.text}</p>}
          </div>
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-sm text-neutral-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> <Text english="Gramamitra is thinking…" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          <Text english={error} />
        </p>
      )}

      {bilingual && (
        <p className="mb-2 text-xs text-neutral-muted">
          <BilingualText english={placeholder} />
        </p>
      )}
      <form onSubmit={sendMessage} className="flex gap-2">
        <label htmlFor={`ai-chat-${complaintId || 'dashboard'}`} className="sr-only">
          <Text english={placeholder} />
        </label>
        <input
          id={`ai-chat-${complaintId || 'dashboard'}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1000}
          placeholder={bilingual ? translate(placeholder) : placeholder}
          disabled={isSending}
          className="min-w-0 flex-1 rounded-full border border-neutral-light bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-ink"
        />
        <button
          type="submit"
          disabled={isSending || !message.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-ink text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={bilingual ? translate('Send message') : 'Send message'}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}
