import { Observable } from 'rxjs/Observable';

import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';

export function decodeResponse(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

export function encodeCommand(cmd: string) {
	const encoded = new TextEncoder('utf-8').encode(`${cmd}`);
	return encoded;
}

export async function observableCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic) {
	await characteristic.startNotifications();
	const disconnected = Observable.fromEvent(characteristic.service!.device, 'gattserverdisconnected');
	return Observable.fromEvent(characteristic, 'characteristicvaluechanged')
		.takeUntil(disconnected)
		.map((event: Event) => (event.target as BluetoothRemoteGATTCharacteristic).value as DataView);
}

/** Accel packets */
const obciGanglionAccelAxisX = 1;
const obciGanglionAccelAxisY = 2;
const obciGanglionAccelAxisZ = 3;

/** Accel scale factor */
const obciGanglionAccelScaleFactor = 0.016; // mG per count

/** Ganglion */
const obciGanglionBleSearchTime = 20000; // ms
const obciGanglionByteIdUncompressed = 0;
const obciGanglionByteId18Bit = {
	max: 100,
	min: 1
};
const obciGanglionByteId19Bit = {
	max: 200,
	min: 101
};
const obciGanglionByteIdImpedanceChannel1 = 201;
const obciGanglionByteIdImpedanceChannel2 = 202;
const obciGanglionByteIdImpedanceChannel3 = 203;
const obciGanglionByteIdImpedanceChannel4 = 204;
const obciGanglionByteIdImpedanceChannelReference = 205;
const obciGanglionByteIdMultiPacket = 206;
const obciGanglionByteIdMultiPacketStop = 207;
const obciGanglionPacketSize = 20;
const obciGanglionSamplesPerPacket = 2;
const obciGanglionPacket18Bit = {
	auxByte: 20,
	byteId: 0,
	dataStart: 1,
	dataStop: 19
};
const obciGanglionPacket19Bit = {
	byteId: 0,
	dataStart: 1,
	dataStop: 20
};
const obciGanglionMCP3912Gain = 51.0;  // assumed gain setting for MCP3912.  NEEDS TO BE ADJUSTABLE JM
const obciGanglionMCP3912Vref = 1.2;  // reference voltage for ADC in MCP3912 set in hardware
const obciGanglionPrefix = 'Ganglion';
const obciGanglionSyntheticDataEnable = 't';
const obciGanglionSyntheticDataDisable = 'T';
const obciGanglionImpedanceStart = 'z';
const obciGanglionImpedanceStop = 'Z';
const obciGanglionScaleFactorPerCountVolts = obciGanglionMCP3912Vref / (8388607.0 * obciGanglionMCP3912Gain * 1.5);


export const k = {
	/** Accel packets */
	OBCIGanglionAccelAxisX: obciGanglionAccelAxisX,
	OBCIGanglionAccelAxisY: obciGanglionAccelAxisY,
	OBCIGanglionAccelAxisZ: obciGanglionAccelAxisZ,
	/** Ganglion */
	OBCIGanglionBleSearchTime: obciGanglionBleSearchTime,
	OBCIGanglionByteIdUncompressed: obciGanglionByteIdUncompressed,
	OBCIGanglionByteId18Bit: obciGanglionByteId18Bit,
	OBCIGanglionByteId19Bit: obciGanglionByteId19Bit,
	OBCIGanglionByteIdImpedanceChannel1: obciGanglionByteIdImpedanceChannel1,
	OBCIGanglionByteIdImpedanceChannel2: obciGanglionByteIdImpedanceChannel2,
	OBCIGanglionByteIdImpedanceChannel3: obciGanglionByteIdImpedanceChannel3,
	OBCIGanglionByteIdImpedanceChannel4: obciGanglionByteIdImpedanceChannel4,
	OBCIGanglionByteIdImpedanceChannelReference: obciGanglionByteIdImpedanceChannelReference,
	OBCIGanglionByteIdMultiPacket: obciGanglionByteIdMultiPacket,
	OBCIGanglionByteIdMultiPacketStop: obciGanglionByteIdMultiPacketStop,
	OBCIGanglionMCP3912Gain: obciGanglionMCP3912Gain,  // assumed gain setting for MCP3912.  NEEDS TO BE ADJUSTABLE JM
	OBCIGanglionMCP3912Vref: obciGanglionMCP3912Vref,  // reference voltage for ADC in MCP3912 set in hardware
	OBCIGanglionPacketSize: obciGanglionPacketSize,
	OBCIGanglionPacket18Bit: obciGanglionPacket18Bit,
	OBCIGanglionPacket19Bit: obciGanglionPacket19Bit,
	OBCIGanglionPrefix: obciGanglionPrefix,
	OBCIGanglionSamplesPerPacket: obciGanglionSamplesPerPacket,
	OBCIGanglionSyntheticDataEnable: obciGanglionSyntheticDataEnable,
	OBCIGanglionSyntheticDataDisable: obciGanglionSyntheticDataDisable,
	OBCIGanglionImpedanceStart: obciGanglionImpedanceStart,
	OBCIGanglionImpedanceStop: obciGanglionImpedanceStop,
	OBCIGanglionScaleFactorPerCountVolts: obciGanglionScaleFactorPerCountVolts
};
