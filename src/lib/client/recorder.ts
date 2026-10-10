// Grava o microfone direto em PCM 16 kHz mono e gera um WAV.
// Não usa MediaRecorder porque ele produz webm (Android) ou mp4 (iOS), e os modelos de áudio
// da OpenRouter esperam wav/mp3. A reamostragem é feita em streaming para economizar memória
// (16 kHz × 16 bits ≈ 1,9 MB por minuto).

export const SAMPLE_RATE = 16000;

export class Recorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  private chunks: Int16Array[] = [];
  private samples = 0;
  private stream?: MediaStream;
  private ctx?: AudioContext;

  get duration() {
    return this.samples / SAMPLE_RATE;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule('/pcm-worklet.js');

    const source = this.ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(this.ctx, 'pcm-capture');
    const downsampler = new Downsampler(this.ctx.sampleRate, SAMPLE_RATE);
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.state !== 'recording') return;
      const pcm = downsampler.process(e.data);
      this.chunks.push(pcm);
      this.samples += pcm.length;
    };

    // Alguns navegadores só executam o worklet se ele estiver ligado ao destino; o ganho 0 evita eco.
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(this.ctx.destination);

    this.chunks = [];
    this.samples = 0;
    this.state = 'recording';
  }

  async pause() {
    this.state = 'paused';
    await this.ctx?.suspend();
  }

  async resume() {
    await this.ctx?.resume();
    this.state = 'recording';
  }

  /** Encerra a gravação e retorna o WAV e a duração em segundos. */
  async stop(): Promise<{ blob: Blob; duration: number }> {
    await this.release();
    const blob = encodeWav(this.chunks, this.samples, SAMPLE_RATE);
    const duration = this.duration;
    this.chunks = [];
    return { blob, duration };
  }

  /** Descarta a gravação em andamento. */
  async cancel() {
    await this.release();
    this.chunks = [];
    this.samples = 0;
  }

  private async release() {
    this.state = 'inactive';
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
  }
}

/** Reamostragem por média de blocos (suficiente para voz), mantendo estado entre chamadas. */
class Downsampler {
  private ratio: number;
  private pos = 0;
  private acc = 0;
  private count = 0;

  constructor(inRate: number, outRate: number) {
    this.ratio = inRate / outRate;
  }

  process(input: Float32Array): Int16Array {
    const out = new Int16Array(Math.ceil(input.length / this.ratio) + 1);
    let n = 0;
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i];
      this.count++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.count));
        out[n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.acc = 0;
        this.count = 0;
      }
    }
    return out.subarray(0, n);
  }
}

function encodeWav(chunks: Int16Array[], samples: number, sampleRate: number): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const writeStr = (offset: number, s: string) => [...s].forEach((c, i) => header.setUint8(offset + i, c.charCodeAt(0)));
  const dataSize = samples * 2;
  writeStr(0, 'RIFF');
  header.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  header.setUint32(16, 16, true); // tamanho do bloco fmt
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // byte rate
  header.setUint16(32, 2, true); // block align
  header.setUint16(34, 16, true); // bits por amostra
  writeStr(36, 'data');
  header.setUint32(40, dataSize, true);
  return new Blob([header, ...(chunks as BlobPart[])], { type: 'audio/wav' });
}
