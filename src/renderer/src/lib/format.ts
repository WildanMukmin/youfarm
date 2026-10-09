const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatDate = (iso: string): string => date.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso))
