"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

// Wraps a plain password input with a show/hide toggle. Kept as a thin
// passthrough (id/required/value/onChange/minLength/aria-* all flow to the
// real <input> via ...props) so callers like signup-form/login-form don't
// have to change anything besides the tag name, and label htmlFor/getByLabel
// association keeps working.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="password-field">
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("password-field__input", className)}
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
