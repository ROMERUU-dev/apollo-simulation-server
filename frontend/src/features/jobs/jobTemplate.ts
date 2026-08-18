import {
  CUSTOM_XYCE_TEMPLATE_ID,
  SKY130_TEMPLATE_ID,
  type JobTemplateId,
} from '../../api/jobTypes'

export function jobTemplateLabel(templateId: JobTemplateId): string {
  if (templateId === CUSTOM_XYCE_TEMPLATE_ID) return 'Netlist Xyce personalizada'
  if (templateId === SKY130_TEMPLATE_ID) return 'Oscilador SKY130 (bulk flotante)'
  return 'Simulación RC heredada'
}
