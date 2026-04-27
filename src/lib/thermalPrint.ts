/**
 * Utilitário para Impressão Direta via WebUSB (ESC/POS)
 */

export class ThermalPrinter {
  private device: USBDevice | null = null;

  async requestDevice() {
    try {
      this.device = await navigator.usb.requestDevice({ filters: [] });
      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      
      // Salva o ID da impressora para reconexão automática se possível
      localStorage.setItem('thermal_printer_vendor', this.device.vendorId.toString());
      localStorage.setItem('thermal_printer_product', this.device.productId.toString());
      
      return this.device;
    } catch (error) {
      console.error('Erro ao conectar impressora:', error);
      throw error;
    }
  }

  async print(text: string) {
    if (!this.device) {
      // Tenta reconectar se já houver um ID salvo
      const vendorId = localStorage.getItem('thermal_printer_vendor');
      if (vendorId) {
        try {
          const devices = await navigator.usb.getDevices();
          this.device = devices.find(d => d.vendorId === parseInt(vendorId)) || null;
          if (this.device) {
            await this.device.open();
            await this.device.selectConfiguration(1);
            await this.device.claimInterface(0);
          }
        } catch (e) {
          console.error('Falha na reconexão automática:', e);
        }
      }
    }

    if (!this.device) throw new Error('Impressora não conectada');

    const encoder = new TextEncoder();
    
    // Comandos ESC/POS Básicos
    const INIT = '\x1B\x40';
    const CENTER = '\x1B\x61\x01';
    const LEFT = '\x1B\x61\x00';
    const BOLD_ON = '\x1B\x45\x01';
    const BOLD_OFF = '\x1B\x45\x00';
    const CUT = '\x1D\x56\x00';
    const FEED = '\n\n\n';

    const cleanText = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos (algumas térmicas não aceitam UTF-8)
      .replace(/[^\x00-\x7F]/g, '');

    const data = encoder.encode(INIT + cleanText + FEED + CUT);
    
    // Envia para o endpoint 1 (padrão da maioria das impressoras térmicas)
    try {
        await this.device.transferOut(1, data);
    } catch (e) {
        // Algumas impressoras usam o endpoint 2 ou 3
        try {
            await this.device.transferOut(2, data);
        } catch (e2) {
            await this.device.transferOut(3, data);
        }
    }
  }
}

export const thermalPrinter = new ThermalPrinter();
