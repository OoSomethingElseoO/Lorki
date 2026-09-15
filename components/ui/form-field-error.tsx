import { AlertCircle } from "lucide-react";

interface FormFieldErrorProps {
  message?: string;
  className?: string;
  id?: string;
}

export function FormFieldError({ message, className = "", id }: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <div className={`form-field-error ${className}`} id={id} role="alert">
      <AlertCircle className="form-field-error__icon" aria-hidden="true" size={16} />
      <span className="form-field-error__text">{message}</span>
    </div>
  );
}
