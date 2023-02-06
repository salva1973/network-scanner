const ping = require('ping')
const ip = require('ip')
const fs = require('fs')
const { toMAC } = require('@network-utils/arp-lookup')
const { toVendor } = require('@network-utils/vendor-lookup')

let devices = []

const localIP = ip.address()
let subnet = localIP.slice(0, localIP.lastIndexOf('.') + 1)
let deviceCounter = 0
let percentage = 0

async function checkHost(host) {
  try {
    const res = await ping.promise.probe(host)
    deviceCounter++
    percentage = Math.floor((deviceCounter / 254) * 100)
    process.stdout.write(
      `\x1b[33mScanning ${percentage}% complete\x1b[0m    \r`
    )
    if (res.alive) {
      const mac = await toMAC(host)
      const vendor = toVendor(mac)
      const device = {
        'ip-address': host,
        'mac-address': mac,
        'vendor-name': vendor,
        'response-time': res.time,
      }
      if (
        vendor.toLowerCase().trim().includes('elau') ||
        vendor.toLowerCase().trim().includes('schneider') ||
        vendor.toLowerCase().trim().includes('telemecanique')
      ) {
        device.additional = {
          type: 'Schneider Controller',
        }
      } else if (vendor.toLowerCase().trim().includes('axis')) {
        device.additional = {
          type: 'IP Camera',
        }
      }

      devices.push(device)
    }
  } catch (err) {
    console.error(err)
  }
}

async function getVendorName(macAddress) {
  return new Promise((resolve, reject) => {
    macLookup(macAddress, (err, vendor) => {
      if (err) {
        reject(err)
      } else {
        resolve(vendor)
      }
    })
  })
}

function sortByIpAddress(array, keyName) {
  array.sort(function (a, b) {
    let aNum = 0
    let bNum = 0

    const aParts = a[keyName].split('.')
    const bParts = b[keyName].split('.')

    for (let i = 0; i < 4; i++) {
      aNum += aParts[i] * Math.pow(256, 3 - i)
      bNum += bParts[i] * Math.pow(256, 3 - i)
    }

    return aNum - bNum
  })
}

async function writeJSONFile(filename, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, JSON.stringify(data, null, 4), err => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function asyncWait(time) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, time)
  })
}

const scanNetwork = async subNetwork => {
  try {
    if (typeof subNetwork !== 'undefined') {
      subnet = subNetwork.slice(0, subNetwork.lastIndexOf('.') + 1) // override
    }
    console.log(`\x1b[34mScanning network ${subnet}0...\x1b[0m`)
    const hostChecks = []
    for (let i = 1; i <= 254; i++) {
      const host = subnet + i
      hostChecks.push(checkHost(host))
    }
    await Promise.all(hostChecks).catch(console.error)
    if (devices.length !== 0) {
      process.stdout.write('\x1b[33mSorting the devices...\x1b[0m         \r')
      await asyncWait(500)
      sortByIpAddress(devices, 'ip-address')
      process.stdout.write('\x1b[33mSaving the file...\x1b[0m             \r')
      await asyncWait(500)
      await writeJSONFile('devices.json', devices)
      console.log(
        `\x1b[32mSaved ${devices.length} devices to 'devices.json'.\x1b[0m`
      )
    } else {
      console.log(
        '\x1b[31mNo devices found. Check your network connection!\x1b[0m'
      )
    }
  } catch (err) {
    console.error(err)
  }
}

module.exports = scanNetwork
