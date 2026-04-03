export function ApiErrorBanner({ error }: { error: string | null | undefined }) {
  if (!error) {
    return null;
  }

  return (
    <p className="error-text" role="alert" aria-live="polite">
      {error}
    </p>
  );
}
