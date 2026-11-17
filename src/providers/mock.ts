import type { FormProvider, Metadata, Interface, Context, Layout, Summary } from '../types.js';

const sampleXdp = `<?xml version="1.0" encoding="UTF-8"?>
<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">
  <template xmlns="http://www.xfa.org/schema/xfa-template/3.3/">
    <subform name="root">
      <subform name="HEADER">
        <field name="INVOICE_NO"><event activity="initialize"><script contentType="application/x-formcalc">$.rawValue = "DEMO-001"</script></event></field>
        <field name="AMOUNT"><event activity="calculate"><script contentType="application/x-javascript">this.rawValue = 100.25;</script></event></field>
      </subform>
      <event activity="layout:ready"><script contentType="application/x-javascript">// Demonstration only\nxfa.layout.relayout();</script></event>
    </subform>
  </template>
</xdp:xdp>`;

const fixtures: Array<{ metadata: Metadata; formInterface: Interface; context: Context; layout: Layout }> = [
  {
    metadata: { name: 'ZDEMO_INVOICE', description: '[MOCK] Example customer invoice', package: 'ZDEMO_FORMS', interfaceName: 'ZIF_DEMO_INVOICE', active: true, originalLanguage: 'EN', lastChangedAt: null, technology: 'SFP_CLASSIC' },
    formInterface: { formName: 'ZDEMO_INVOICE', interfaceName: 'ZIF_DEMO_INVOICE', interfaceType: 'ABAP_DDIC', parameters: [
      { name: 'IS_HEADER', direction: 'IMPORTING', type: 'ZSTR_DEMO_HEADER', description: 'Invoice header' },
      { name: 'IT_ITEMS', direction: 'IMPORTING', type: 'ZTT_DEMO_ITEMS' }
    ] },
    context: { formName: 'ZDEMO_INVOICE', nodes: [{ name: 'HEADER', kind: 'STRUCTURE', children: [
      { name: 'INVOICE_NO', kind: 'FIELD', binding: 'IS_HEADER-INVOICE_NO' },
      { name: 'AMOUNT', kind: 'FIELD', binding: 'IS_HEADER-AMOUNT' }
    ] }, { name: 'ITEMS', kind: 'TABLE', binding: 'IT_ITEMS' }] },
    layout: { formName: 'ZDEMO_INVOICE', xdpBase64: Buffer.from(sampleXdp).toString('base64') }
  },
  {
    metadata: { name: 'ZDEMO_ADVICE', description: '[MOCK] Example payment advice', package: 'ZDEMO_FORMS', interfaceName: 'ZIF_DEMO_ADVICE', active: true, originalLanguage: 'EN', lastChangedAt: null, technology: 'SFP_CLASSIC' },
    formInterface: { formName: 'ZDEMO_ADVICE', interfaceName: 'ZIF_DEMO_ADVICE', interfaceType: 'ABAP_DDIC', parameters: [
      { name: 'IV_PARTNER', direction: 'IMPORTING', type: 'BU_PARTNER' }
    ] },
    context: { formName: 'ZDEMO_ADVICE', nodes: [{ name: 'PARTNER', kind: 'FIELD', binding: 'IV_PARTNER' }] },
    layout: { formName: 'ZDEMO_ADVICE', xdpBase64: Buffer.from(sampleXdp.replaceAll('INVOICE_NO', 'PARTNER')).toString('base64') }
  }
];

function matchGlob(text: string, pattern: string): boolean {
  const escaped = pattern.replace(/[|\\{}()[\]^$+.]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(text);
}

export class MockProvider implements FormProvider {
  private pick(name: string) {
    const fixture = fixtures.find((f) => f.metadata.name === name.toUpperCase());
    if (!fixture) throw new Error(`Form not found: ${name} (MOCK provider)`);
    return fixture;
  }
  async listCustomForms(_destination: string, pattern: string, limit: number): Promise<Summary[]> {
    return fixtures.filter((f) => matchGlob(f.metadata.name, pattern)).slice(0, limit).map(({ metadata: { name, description, package: pack, interfaceName, active } }) => ({ name, description, package: pack, interfaceName, active }));
  }
  async getFormMetadata(_destination: string, name: string): Promise<Metadata> { return this.pick(name).metadata; }
  async getFormInterface(_destination: string, name: string): Promise<Interface> { return this.pick(name).formInterface; }
  async getFormContext(_destination: string, name: string): Promise<Context> { return this.pick(name).context; }
  async getFormLayout(_destination: string, name: string): Promise<Layout> { return this.pick(name).layout; }
}
