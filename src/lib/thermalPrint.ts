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
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\x00-\x7F]/g, '');

    const data = encoder.encode(INIT + cleanText + FEED + CUT);
    await this.sendData(data);
  }

  /**
   * Imprime texto seguido de um QR Code (útil para NFC-e)
   */
  async printWithQRCode(text: string, qrCodeData: string) {
    if (!this.device) await this.requestDevice();
    if (!this.device) throw new Error('Impressora não conectada');

    const encoder = new TextEncoder();
    
    // Comandos Iniciais
    const INIT = '\x1B\x40';
    const CENTER = '\x1B\x61\x01';
    const FEED = '\n\n';
    const CUT = '\x1D\x56\x00';

    const cleanText = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7F]/g, '');

    // Comandos QR Code (Padrão ESC/POS)
    const storeLen = qrCodeData.length + 3;
    const storeL = storeLen & 0xFF;
    const storeH = (storeLen >> 8) & 0xFF;

    const qrCommands = [
      '\x1B\x61\x01', // Centralizar
      '\x1D\x28\x6B\x04\x00\x31\x41\x32\x00', // Modelo 2
      '\x1D\x28\x6B\x03\x00\x31\x43\x08',     // Tamanho do módulo (8)
      '\x1D\x28\x6B\x03\x00\x31\x45\x30',     // Correção de erro L
      `\x1D\x28\x6B${String.fromCharCode(storeL)}${String.fromCharCode(storeH)}\x31\x50\x30${qrCodeData}`, // Armazenar dados
      '\x1D\x28\x6B\x03\x00\x31\x51\x30',     // Imprimir QR Code
    ].join('');

    const mainData = encoder.encode(INIT + cleanText + FEED);
    const qrData = encoder.encode(qrCommands + '\n\n\n' + CUT);
    
    const combinedData = new Uint8Array(mainData.length + qrData.length);
    combinedData.set(mainData);
    combinedData.set(qrData, mainData.length);

    await this.sendData(combinedData);
  }

  private async sendData(data: Uint8Array) {
    if (!this.device) return;
    try {
        await this.device.transferOut(1, data);
    } catch (e) {
        try {
            await this.device.transferOut(2, data);
        } catch (e2) {
            await this.device.transferOut(3, data);
        }
    }
  }
}

export const thermalPrinter = new ThermalPrinter();
