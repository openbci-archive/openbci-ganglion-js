import { Observable } from 'rxjs/Observable';

import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/scan';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';

import { EEGReading, TelemetryData, AccelerometerData, GyroscopeData } from './ganglion-interfaces';
import { k } from './ganglion-utils';

export function parseControl(controlData: Observable<string>) {
    return controlData
        .concatMap(data => data.split(''))
        .scan((acc, value) => {
            if (acc.indexOf('}') >= 0) {
                return value;
            } else {
                return acc + value;
            }
        }, '')
        .filter(value => value.indexOf('}') >= 0)
        .map(value => JSON.parse(value));
}

export function decodeUnsigned12BitData(samples: Uint8Array) {
    const samples12Bit = [];
    for (let i = 0; i < samples.length; i++) {
        if (i % 3 === 0) {
            samples12Bit.push(samples[i] << 4 | samples[i + 1] >> 4);
        } else {
            samples12Bit.push((samples[i] & 0xf) << 8 | samples[i + 1]);
            i++;
        }
    }
    return samples12Bit;
}

export function decodeEEGSamples(data: Uint8Array) {
    let byteId = data.getInt8(0);
    if (byteId <= k.OBCIGanglionByteId19Bit.max) {
        processProcessSampleData(data);
    } else {
        switch (byteId) {
            case k.OBCIGanglionByteIdMultiPacket:
                this._processMultiBytePacket(data);
                break;
            case k.OBCIGanglionByteIdMultiPacketStop:
                this._processMultiBytePacketStop(data);
                break;
            case k.OBCIGanglionByteIdImpedanceChannel1:
            case k.OBCIGanglionByteIdImpedanceChannel2:
            case k.OBCIGanglionByteIdImpedanceChannel3:
            case k.OBCIGanglionByteIdImpedanceChannel4:
            case k.OBCIGanglionByteIdImpedanceChannelReference:
                this._processImpedanceData(data);
                break;
            default:
                this._processOtherData(data);
        }
    }
    return decodeUnsigned12BitData(samples)
        .map(n => 0.48828125 * (n - 0x800));
}

export function parseAccelerometer(data: DataView): AccelerometerData {
    function sample(startIndex: number) {
        return {
            x: data.getInt16(startIndex),
            y: data.getInt16(startIndex + 2),
            z: data.getInt16(startIndex + 4),
        };
    }
    return {
        sequenceId: data.getUint16(0),
        samples: [sample(2), sample(8), sample(14)]
    };
}

export function processRouteSampleData(data: Uint8Array) {
    if (data.getInt8(0) === k.OBCIGanglionByteIdUncompressed) {
        this._processUncompressedData(data);
    } else {
        this._processCompressedData(data);
    }
};

/**
 * Checks for dropped packets
 * @param data {Buffer}
 * @private
 */
export function processProcessSampleData(data) {
    const curByteId = parseInt(data[0]);
    const difByteId = curByteId - this._packetCounter;

    if (this._firstPacket) {
        this._firstPacket = false;
        this._processRouteSampleData(data);
        return;
    }

    // Wrap around situation
    if (difByteId < 0) {
        if (this._packetCounter <= k.OBCIGanglionByteId18Bit.max) {
            if (this._packetCounter === k.OBCIGanglionByteId18Bit.max) {
                if (curByteId !== k.OBCIGanglionByteIdUncompressed) {
                    this._droppedPacket(curByteId - 1);
                }
            } else {
                let tempCounter = this._packetCounter + 1;
                while (tempCounter <= k.OBCIGanglionByteId18Bit.max) {
                    this._droppedPacket(tempCounter);
                    tempCounter++;
                }
            }
        } else if (this._packetCounter === k.OBCIGanglionByteId19Bit.max) {
            if (curByteId !== k.OBCIGanglionByteIdUncompressed) {
                this._droppedPacket(curByteId - 1);
            }
        } else {
            let tempCounter = this._packetCounter + 1;
            while (tempCounter <= k.OBCIGanglionByteId19Bit.max) {
                this._droppedPacket(tempCounter);
                tempCounter++;
            }
        }
    } else if (difByteId > 1) {
        if (this._packetCounter === k.OBCIGanglionByteIdUncompressed && curByteId === k.OBCIGanglionByteId19Bit.min) {
            this._processRouteSampleData(data);
            return;
        } else {
            let tempCounter = this._packetCounter + 1;
            while (tempCounter < curByteId) {
                this._droppedPacket(tempCounter);
                tempCounter++;
            }
        }
    }
    this._processRouteSampleData(data);
};

/**
 * Converts a special ganglion 18 bit compressed number
 *  The compressions uses the LSB, bit 1, as the signed bit, instead of using
 *  the MSB. Therefore you must not look to the MSB for a sign extension, one
 *  must look to the LSB, and the same rules applies, if it's a 1, then it's a
 *  negative and if it's 0 then it's a positive number.
 * @param threeByteBuffer {Uint8Array}
 *  A 3-byte buffer with only 18 bits of actual data.
 * @return {number} A signed integer.
 */
export function convert18bitAsInt32 (threeByteBuffer: Uint8Array) {
  let prefix = 0;

  if (threeByteBuffer[2] & 0x01 > 0) {
    // console.log('\t\tNegative number')
    prefix = 0b11111111111111;
  }

  return (prefix << 18) | (threeByteBuffer[0] << 16) | (threeByteBuffer[1] << 8) | threeByteBuffer[2];
}

/**
 * Converts a special ganglion 19 bit compressed number
 *  The compressions uses the LSB, bit 1, as the signed bit, instead of using
 *  the MSB. Therefore you must not look to the MSB for a sign extension, one
 *  must look to the LSB, and the same rules applies, if it's a 1, then it's a
 *  negative and if it's 0 then it's a positive number.
 * @param threeByteBuffer {Uint8Array}
 *  A 3-byte buffer with only 19 bits of actual data.
 * @return {number} A signed integer.
 */
export function convert19bitAsInt32 (threeByteBuffer: Uint8Array) {
  let prefix = 0;

  if (threeByteBuffer[2] & 0x01 > 0) {
    // console.log('\t\tNegative number')
    prefix = 0b1111111111111;
  }

  return (prefix << 19) | (threeByteBuffer[0] << 16) | (threeByteBuffer[1] << 8) | threeByteBuffer[2];
}

/**
 * Called to when a compressed packet is received.
 * @param buffer {Uint8Array} Just the data portion of the sample. So 18 bytes.
 * @return {Array} - An array of deltas of shape 2x4 (2 samples per packet
 *  and 4 channels per sample.)
 */
export function decompressDeltas18Bit (buffer: Uint8Array) {
  let D = new Array(k.OBCIGanglionSamplesPerPacket); // 2 Ganglion Samples Per Packet
  D[0] = [0, 0, 0, 0];
  D[1] = [0, 0, 0, 0];

  let receivedDeltas = [];
  for (let i = 0; i < k.OBCIGanglionSamplesPerPacket; i++) {
    receivedDeltas.push([0, 0, 0, 0]);
  }

  let miniBuf;

  // Sample 1 - Channel 1
  miniBuf = new Uint8Array(
    [
      (buffer[0] >> 6),
      ((buffer[0] & 0x3F) << 2) | (buffer[1] >> 6),
      ((buffer[1] & 0x3F) << 2) | (buffer[2] >> 6)
    ]
  );
  receivedDeltas[0][0] = convert18bitAsInt32(miniBuf);

  // Sample 1 - Channel 2
  miniBuf = new Uint8Array(
    [
      (buffer[2] & 0x3F) >> 4,
      (buffer[2] << 4) | (buffer[3] >> 4),
      (buffer[3] << 4) | (buffer[4] >> 4)
    ]);
  receivedDeltas[0][1] = convert18bitAsInt32(miniBuf);

  // Sample 1 - Channel 3
  miniBuf = new Uint8Array(
    [
      (buffer[4] & 0x0F) >> 2,
      (buffer[4] << 6) | (buffer[5] >> 2),
      (buffer[5] << 6) | (buffer[6] >> 2)
    ]);
  receivedDeltas[0][2] = convert18bitAsInt32(miniBuf);

  // Sample 1 - Channel 4
  miniBuf = new Uint8Array(
    [
      (buffer[6] & 0x03),
      buffer[7],
      buffer[8]
    ]);
  receivedDeltas[0][3] = convert18bitAsInt32(miniBuf);

  // Sample 2 - Channel 1
  miniBuf = new Uint8Array(
    [
      (buffer[9] >> 6),
      ((buffer[9] & 0x3F) << 2) | (buffer[10] >> 6),
      ((buffer[10] & 0x3F) << 2) | (buffer[11] >> 6)
    ]);
  receivedDeltas[1][0] = convert18bitAsInt32(miniBuf);

  // Sample 2 - Channel 2
  miniBuf = new Uint8Array(
    [
      (buffer[11] & 0x3F) >> 4,
      (buffer[11] << 4) | (buffer[12] >> 4),
      (buffer[12] << 4) | (buffer[13] >> 4)
    ]);
  receivedDeltas[1][1] = convert18bitAsInt32(miniBuf);

  // Sample 2 - Channel 3
  miniBuf = new Uint8Array(
    [
      (buffer[13] & 0x0F) >> 2,
      (buffer[13] << 6) | (buffer[14] >> 2),
      (buffer[14] << 6) | (buffer[15] >> 2)
    ]);
  receivedDeltas[1][2] = convert18bitAsInt32(miniBuf);

  // Sample 2 - Channel 4
  miniBuf = new Uint8Array([(buffer[15] & 0x03), buffer[16], buffer[17]]);
  receivedDeltas[1][3] = convert18bitAsInt32(miniBuf);

  return receivedDeltas;
}

/**
 * Called to when a compressed packet is received.
 * @param buffer {Uint8Array} Just the data portion of the sample. So 19 bytes.
 * @return {Array} - An array of deltas of shape 2x4 (2 samples per packet
 *  and 4 channels per sample.)
 * @private
 */
export function decompressDeltas19Bit (buffer: Uint8Array) {
  let D = new Array(k.OBCIGanglionSamplesPerPacket); // 2
  D[0] = [0, 0, 0, 0];
  D[1] = [0, 0, 0, 0];

  let receivedDeltas = [];
  for (let i = 0; i < k.OBCIGanglionSamplesPerPacket; i++) {
    receivedDeltas.push([0, 0, 0, 0]);
  }

  let miniBuf;

  // Sample 1 - Channel 1
  miniBuf = new Uint8Array(
    [
      (buffer[0] >> 5),
      ((buffer[0] & 0x1F) << 3) | (buffer[1] >> 5),
      ((buffer[1] & 0x1F) << 3) | (buffer[2] >> 5)
    ]
  );
  receivedDeltas[0][0] = convert19bitAsInt32(miniBuf);

  // Sample 1 - Channel 2
  miniBuf = new Uint8Array(
    [
      (buffer[2] & 0x1F) >> 2,
      (buffer[2] << 6) | (buffer[3] >> 2),
      (buffer[3] << 6) | (buffer[4] >> 2)
    ]);
  receivedDeltas[0][1] = convert19bitAsInt32(miniBuf);

  // Sample 1 - Channel 3
  miniBuf = new Uint8Array(
    [
      ((buffer[4] & 0x03) << 1) | (buffer[5] >> 7),
      ((buffer[5] & 0x7F) << 1) | (buffer[6] >> 7),
      ((buffer[6] & 0x7F) << 1) | (buffer[7] >> 7)
    ]);
  receivedDeltas[0][2] = convert19bitAsInt32(miniBuf);

  // Sample 1 - Channel 4
  miniBuf = new Uint8Array(
    [
      ((buffer[7] & 0x7F) >> 4),
      ((buffer[7] & 0x0F) << 4) | (buffer[8] >> 4),
      ((buffer[8] & 0x0F) << 4) | (buffer[9] >> 4)
    ]);
  receivedDeltas[0][3] = convert19bitAsInt32(miniBuf);

  // Sample 2 - Channel 1
  miniBuf = new Uint8Array(
    [
      ((buffer[9] & 0x0F) >> 1),
      (buffer[9] << 7) | (buffer[10] >> 1),
      (buffer[10] << 7) | (buffer[11] >> 1)
    ]);
  receivedDeltas[1][0] = convert19bitAsInt32(miniBuf);

  // Sample 2 - Channel 2
  miniBuf = new Uint8Array(
    [
      ((buffer[11] & 0x01) << 2) | (buffer[12] >> 6),
      (buffer[12] << 2) | (buffer[13] >> 6),
      (buffer[13] << 2) | (buffer[14] >> 6)
    ]);
  receivedDeltas[1][1] = convert19bitAsInt32(miniBuf);

  // Sample 2 - Channel 3
  miniBuf = new Uint8Array(
    [
      ((buffer[14] & 0x38) >> 3),
      ((buffer[14] & 0x07) << 5) | ((buffer[15] & 0xF8) >> 3),
      ((buffer[15] & 0x07) << 5) | ((buffer[16] & 0xF8) >> 3)
    ]);
  receivedDeltas[1][2] = convert19bitAsInt32(miniBuf);

  // Sample 2 - Channel 4
  miniBuf = new Uint8Array([(buffer[16] & 0x07), buffer[17], buffer[18]]);
  receivedDeltas[1][3] = convert19bitAsInt32(miniBuf);

  return receivedDeltas;
}