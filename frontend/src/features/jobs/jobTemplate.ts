import { CUSTOM_XYCE_TEMPLATE_ID, type JobTemplateId } from '../../api/jobTypes'

export function jobTemplateLabel(templateId: JobTemplateId): string {
  if (templateId === CUSTOM_XYCE_TEMPLATE_ID) return 'Netlist Xyce personalizada'
  return 'Simulación RC heredada'
}
