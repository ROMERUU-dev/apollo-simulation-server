import { FIXED_RC_TEMPLATE_ID, type JobTemplateId } from '../../api/jobTypes'

export function jobTemplateLabel(templateId: JobTemplateId): string {
  return templateId === FIXED_RC_TEMPLATE_ID ? 'Prueba RC fija' : 'RC configurable'
}
