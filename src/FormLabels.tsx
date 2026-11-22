export function RequiredLabel({ children }: { children: string }) {
  return <span>{children} <span className="required-mark" aria-hidden="true">*</span></span>
}

export function RequiredFieldsHint() {
  return <p className="required-fields-hint">Fields marked with an asterisk (*) are required.</p>
}
