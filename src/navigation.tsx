import { createContext, useContext } from 'react'
import type { ComponentProps } from 'react'

export const Navigation = createContext((to: string) => { window.location.assign(to) })
export const useNavigate = () => useContext(Navigation)

export function RouteLink({ to, ...props }: Omit<ComponentProps<'a'>, 'href'> & { to: string }) {
  const navigate = useNavigate()
  return <a {...props} href={to} onClick={(event) => {
    props.onClick?.(event)
    if (event.defaultPrevented || props.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }} />
}
