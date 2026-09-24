// Symbol input + submit. Validates client-side with the same rule the
// backend enforces (validation.ts) before ever calling onSubmit, so an
// invalid symbol never reaches the network. Deliberately never disabled
// while a request is loading: resubmitting mid-request is the exact scenario
// App's AbortController is meant to handle, not something to prevent here.

import { useState, type FormEvent } from "react";
import { isValidSymbol } from "../validation";

interface SymbolFormProps {
  onSubmit: (symbol: string) => void;
}

export function SymbolForm({ onSubmit }: SymbolFormProps) {
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();

    if (!isValidSymbol(trimmed)) {
      setValidationError("Enter 1-15 letters, digits, or . - ^ =");
      return;
    }

    setValidationError(null);
    onSubmit(trimmed.toUpperCase());
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="symbol-input">Stock symbol</label>
      <input
        id="symbol-input"
        name="symbol"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
      />
      <button type="submit">Get daily data</button>
      {validationError !== null && (
        <p role="alert" className="validation-error">
          {validationError}
        </p>
      )}
    </form>
  );
}
