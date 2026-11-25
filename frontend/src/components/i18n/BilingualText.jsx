import { useTranslation } from 'react-i18next';

export default function BilingualText({
  english,
  values = {},
  as: Element = 'span',
  className,
  translatedClassName = 'block',
  englishClassName = 'mt-0.5 block text-[0.78em] font-normal leading-snug opacity-75',
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || 'en';
  const sourceText = String(english ?? '');
  const translated = t(sourceText, {
    ...values,
    defaultValue: sourceText,
    keySeparator: false,
  });
  const englishText = sourceText.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
  const showEnglish = language !== 'en' && translated !== sourceText;
  const outerClassName = ['inline-flex min-w-0 flex-col align-middle', className].filter(Boolean).join(' ');

  return (
    <Element className={outerClassName}>
      <span className={translatedClassName} lang={language} dir={language === 'ur' ? 'rtl' : 'auto'}>
        {translated}
      </span>
      {showEnglish && (
        <span className={englishClassName} lang="en" dir="ltr">
          {englishText}
        </span>
      )}
    </Element>
  );
}
