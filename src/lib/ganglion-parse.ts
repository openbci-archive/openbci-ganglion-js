import { Observable } from 'rxjs/Observable';

import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/scan';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';

import { EEGReading, AccelerometerData } from './ganglion-interfaces';
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

export function decodeEEGSamples(data: Uint8Array, decompressedSamples: Array, accelArray: Array) {
    return _processRouteSampleData(data, decompressedSamples, accelArray);
    // ATTENTION: FOR LATER WE MUST PARSE RAW DATA BASED ON BYTE ID
    // let byteId = data[0];
    // if (byteId <= k.OBCIGanglionByteId19Bit.max) {
    //     _processRouteSampleData(data);
    // } else {
    //     switch (byteId) {
    //         case k.OBCIGanglionByteIdMultiPacket:
    //             this._processMultiBytePacket(data);
    //             break;
    //         case k.OBCIGanglionByteIdMultiPacketStop:
    //             this._processMultiBytePacketStop(data);
    //             break;
    //         case k.OBCIGanglionByteIdImpedanceChannel1:
    //         case k.OBCIGanglionByteIdImpedanceChannel2:
    //         case k.OBCIGanglionByteIdImpedanceChannel3:
    //         case k.OBCIGanglionByteIdImpedanceChannel4:
    //         case k.OBCIGanglionByteIdImpedanceChannelReference:
    //             this._processImpedanceData(data);
    //             break;
    //         default:
    //             this._processOtherData(data);
    //     }
    // }
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

// //////// //
// PRIVATES //
// //////// //
/**
 * Builds a sample object from an array and sample number.
 * @param decompressedSamples {Array} - An array that of three
 *  samples to compute and store deltas through each cycle
 * @return {{sampleNumber: *}}
 * @private
 */
function _buildSampleCompressed (decompressedSamples: Array) {
    let out = [];
    for (let i = 0; i < k.OBCINumberOfChannelsGanglion; i++) {
        out.push({
            electrode: i,
            timestamp: Date.now(),
            samples: [
                decompressedSamples[1][i]  * k.OBCIGanglionScaleFactorPerCountVolts,
                decompressedSamples[2][i]  * k.OBCIGanglionScaleFactorPerCountVolts
            ]
        })
    }
    return out;
}

/**
 * Builds a sample object from an array and sample number.
 * @param decompressedSamples {Array} - An array that of three
 *  samples to compute and store deltas through each cycle
 * @return {{sampleNumber: *}}
 * @private
 */
function _buildSampleDecompressed (decompressedSamples: Array) {
    let out = [];
    for (let i = 0; i < k.OBCINumberOfChannelsGanglion; i++) {
        out.push({
            electrode: i,
            timestamp: Date.now(),
            samples: [
                decompressedSamples[0][i]  * k.OBCIGanglionScaleFactorPerCountVolts
            ]
        })
    }
    return out;
}

/**
 * Utilize `receivedDeltas` to get actual count values.
 * @param receivedDeltas {Array} - An array of deltas
 *  of shape 2x4 (2 samples per packet and 4 channels per sample.)
 * @param decompressedSamples {Array} - An array that of three
 *  samples to compute and store deltas through each cycle
 * @private
 */
export function _decompressSamples(receivedDeltas: Array, decompressedSamples: Array) {
    // add the delta to the previous value
    for (let i = 1; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            decompressedSamples[i][j] = decompressedSamples[i - 1][j] - receivedDeltas[i - 1][j];
        }
    }
}

/**
 * Process an compressed packet of data.
 * @param data {Uint8Array}
 *  Data packet buffer from noble.
 * @param decompressedSamples {Array} - An array that of three
 *  samples to compute and store deltas through each cycle
*  @param accelArray {Array} - An array to hold casual inter packet data
 * @private
 */
export function _processCompressedData(data: Uint8Array, decompressedSamples: Array, accelArray: Array) {
    // Save the packet counter
    let packetCounter = data[0];
    let eegReadings;
    // Decompress the buffer into array
    if (packetCounter <= k.OBCIGanglionByteId18Bit.max) {
        _decompressSamples(decompressDeltas18Bit(data.slice(k.OBCIGanglionPacket18Bit.dataStart, k.OBCIGanglionPacket18Bit.dataStop)), decompressedSamples);
        eegReadings = _buildSampleCompressed(decompressedSamples);

        switch (packetCounter % 10) {
            case k.OBCIGanglionAccelAxisX:
                accelArray[0] = data[k.OBCIGanglionPacket18Bit.auxByte - 1] * k.OBCIGanglionAccelScaleFactor;
                break;
            case k.OBCIGanglionAccelAxisY:
                accelArray[1] = data[k.OBCIGanglionPacket18Bit.auxByte - 1] * k.OBCIGanglionAccelScaleFactor;
                break;
            case k.OBCIGanglionAccelAxisZ:
                accelArray[2] = data[k.OBCIGanglionPacket18Bit.auxByte - 1] * k.OBCIGanglionAccelScaleFactor;
                break;
            default:
                break;
        }
    } else {
        _decompressSamples(decompressDeltas19Bit(data.slice(k.OBCIGanglionPacket19Bit.dataStart, k.OBCIGanglionPacket19Bit.dataStop)), decompressedSamples);
        eegReadings = _buildSampleCompressed(decompressedSamples);
    }

    // Rotate the 0 position for next time
    for (let i = 0; i < k.OBCINumberOfChannelsGanglion; i++) {
        decompressedSamples[0][i] = decompressedSamples[2][i];
    }

    return eegReadings;
}

export function _processRouteSampleData(data: Uint8Array, decompressedSamples: Array, accelArray: Array) {
    if (data[0] === k.OBCIGanglionByteIdUncompressed) {
        _processUncompressedData(data, decompressedSamples);
    } else {
        _processCompressedData(data, decompressedSamples, accelArray);
    }
}

/**
 * Process an uncompressed packet of data.
 * @param data {Buffer}
 *  Data packet buffer from noble.
 * @private
 */
export function _processUncompressedData(data: Uint8Array, decompressedSamples: Array) {
    let start = 1;

    for (let i = 0; i < 4; i++) {
        decompressedSamples[0][i] = interpret24bitAsInt32(data, start);  // seed the decompressor
        start += 3;
    }

    return _buildSampleDecompressed(decompressedSamples);
}

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

function interpret24bitAsInt32 (byteArray, index) {
    // little endian
    let newInt = (
        ((0xFF & byteArray[index]) << 16) |
        ((0xFF & byteArray[index + 1]) << 8) |
        (0xFF & byteArray[index + 2])
    );
    if ((newInt & 0x00800000) > 0) {
        newInt |= 0xFF000000;
    } else {
        newInt &= 0x00FFFFFF;
    }
    return newInt;
}
