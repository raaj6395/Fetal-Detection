const controlButton = document.getElementById("controlButton")
const input = document.getElementById("input")
const connectionStatus = document.getElementById("connectionStatus")
const bs = document.getElementById('bluetoothState')
const outputText = document.getElementById("output")
const sendButton = document.getElementById("sendButton")
const inputTime = document.getElementById("inputTime")
const startButton = document.getElementById("startButton")
const predictButton = document.querySelector(".predictButton")
const sendArea  = document.querySelector(".sendArea")
const resetButton = document.getElementById("resetButton");
const countButton = document.getElementById("countButton");
const mobileNumber = document.getElementById("inputSession");

sendArea.style.display = "none"

// const dataPoints1 = [{x:0,y:1233},{x:1,y:1263},{x:3,y:1933},{x:4,y:2233}]
// const dataPoints2 = [{x:0,y:123},{x:1,y:263},{x:3,y:933},{x:4,y:223}]
// const dataPoints3 = [{x:0,y:1243},{x:1,y:2463},{x:3,y:9233},{x:4,y:2523}]
// const dataPoints4 = [{x:0,y:1213},{x:1,y:2663},{x:3,y:9733},{x:4,y:2263}]

const dataPoints1 = []
const dataPoints2 = []
const dataPoints3 = []
const dataPoints4 = []

let csvData = `ax1,ay1,az1,ax2,ay2,az2,ax3,ay3,az3,ax4,ay4,az4,label,`;
let receivingData = false; 
let allDataReceived = false; 
let countbt =-2;

const chart = new CanvasJS.Chart("chartContainer", {
  zoomEnabled: true,
 
  axisX: {
    title: "Time"
  },
  axisY:{
    title: "Acceleration",
  }, 
  toolTip: {
    shared: true
  },
  legend: {
    cursor:"pointer",
    verticalAlign: "top",
    fontSize: 22,
    fontColor: "dimGrey",
  },
  data: [{ 
    type: "line",
    name: "Acc1",
    dataPoints: dataPoints1
    },
    {				
      type: "line",
      name: "Acc2" ,
      dataPoints: dataPoints2
    },
    {				
      type: "line",
      name: "Acc3" ,
      dataPoints: dataPoints3
    },
    {				
      type: "line",
      name: "Acc4" ,
      dataPoints: dataPoints4
    }]
})
chart.render()
var xVal = dataPoints1.length + 1;
const updateChart = function (a1,a2,a3,a4) {
  dataPoints1.push({x: xVal,y: a1});
  dataPoints2.push({x: xVal,y: a2});
  dataPoints3.push({x: xVal,y: a3});
  dataPoints4.push({x: xVal,y: a4});
  xVal++;
  if (dataPoints1.length >  40 )
  {
    dataPoints1.shift();				
    dataPoints2.shift();				
    dataPoints3.shift();				
    dataPoints4.shift();				
  }
  chart.render();		
}

function handleBCommand() {
  countbt += 1;
  if(countbt < 0){
    countButton.textContent =0;
  }else{
    countButton.textContent = countbt;
  }
  
}




function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth API is not available in this browser!')
    bs.classList.replace("text-muted", "text-danger")
    bs.innerText = 'Not available'
    return false
  }
  bs.classList.replace("text-muted", "text-success")
  bs.innerText = 'Available'
  return true
}
document.addEventListener('DOMContentLoaded', function() {
  isWebBluetoothEnabled()
}, false)

function handleCharacteristicValueChanged(event) {
  const value = event.target.value;
  const rx_data = String.fromCharCode.apply(null, new Uint8Array(value.buffer));

  if (rx_data[0] === 'c') {
    csvData += rx_data.slice(1);
    receivingData = true;
    console.log("Receiving CSV data: ", csvData);
  } else if (rx_data === 'end') {
    receivingData = false;
    allDataReceived = true;
    console.log("All data received.");
  } 
  else if(!allDataReceived) {
    str = rx_data.substring(1); 
    let values = str.split(',').map(val => parseInt(val));
    console.log(values);
    [a1, a2, a3, a4,label] = values;

    if(values[4]==1){
      handleBCommand();
    }
    updateChart(a1, a2, a3, a4);
  }
}

var error_code = -1
var pairedDevices = ""
var writeCharacteristic = null
var readCharacteristic = null

var writeValue = function () {
	p = new Promise(function (resolve, reject) {
		if (pairedDevices) {
			if (writeCharacteristic != null) {
					let encoder = new TextEncoder('utf-8')
					writeCharacteristic.writeValueWithoutResponse(encoder.encode(input.value))
				  resolve()
			} else {
        alert("No write characteristic ")
				reject("No write characteristic")
			}
		} else {
      alert("No devices paired")
			reject("No devices paired.")
		}
	}).catch(error => { 
    console.log(error)
	})
	return p
}

const startMeasurement = () => {
  p = new Promise(function (resolve, reject) {
		if (pairedDevices) {
			if (writeCharacteristic != null) {
					let encoder = new TextEncoder('utf-8')
          let msg = encoder.encode("start,"+inputTime.value.toString())
					writeCharacteristic.writeValueWithoutResponse(msg)
				  resolve()
			} else {
        alert("No write characteristic ")
				reject("No write characteristic")
			}
		} else {
      alert("No devices paired")
			reject("No devices paired.")
		}
	}).catch(error => { 
    console.log(error)
	})
	return p
}

async function predictResult() {
  return new Promise(async (resolve, reject) => {
    try {
      if (!pairedDevices || writeCharacteristic === null) {
        alert("No devices paired");
        reject("No devices paired.");
        return;
      }

      let encoder = new TextEncoder('utf-8');
      writeCharacteristic.writeValueWithoutResponse(encoder.encode("predict"));

      console.log("Predict command sent. Waiting for data...");
      receivingData = true;
      allDataReceived = false;

      // Wait until all data is received
      while (receivingData) {
        await new Promise(resolve => setTimeout(resolve, 1000)); 
      }

      if (allDataReceived && csvData.length > 0) {
        console.log("CSV data to send: ", csvData);

        const csvBlob = new Blob([csvData], { type: 'text/csv' });
        console.log("CSV Blob size: ", csvBlob.size, " bytes");

       
        const formData = new FormData();
        formData.append('file', csvBlob, `${mobileNumber.value}.csv`); 

        // Make the POST request with the CSV data
        fetch('http://127.0.0.1:5000/api', {
          method: 'POST',
          body: formData,
        })
          .then(response => response.json())
          .then(data => {
            console.log('Success:', data); 
            outputText.textContent = 'Prediction successful!';
        
            // Wait for 1 second before processing the array data
            setTimeout(() => {
              const predictions = data.predictions;
              if (Array.isArray(predictions)) {
                const countOnes = predictions.reduce((acc, val) => acc + (val === 1 ? 1 : 0), 0);
                outputText.textContent = `Predicted Movement : ${countOnes}`;
              } else {
                console.error('Predictions is not an array:', predictions);
                outputText.textContent = 'Unexpected response format';
              }
            }, 1000);
        
            resolve(data);
          })
          .catch((error) => {
            console.error('Error:', error);
            reject(error);
          });
        
      } else {
        console.log("No CSV data to send.");
      }
    } catch (error) {
      console.log("Error:", error);
      reject(error);
    }
  });
}

// Properly add the start and predict event listeners
document.addEventListener('DOMContentLoaded', function() {
  controlButton.addEventListener("click", BLEManager);
  sendButton.addEventListener("click", writeValue);
  startButton.addEventListener("click", async () => {
    // Your start button logic
    await startMeasurement();
    outputText.textContent = "Measurement started. Waiting for predict...";
  });
  predictButton.addEventListener("click", predictResult);
});



async function BLEManager() {
    connectionStatus.textContent = "SEARCHING"
    connectionStatus.classList.replace("text-muted", "text-secondary") 
    error_code = 0
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
        ] 
      })
      pairedDevices = device.name
      error_code = 1
      const connectedDevice = await device.gatt.connect()
      connectionStatus.textContent = "CONNECTED"
      error_code = 2
      connectionStatus.classList.replace("text-secondary", "text-primary") 
      outputText.innerHTML = "Send 'start' to start measurement"
      const service = await connectedDevice.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e")
      console.log("Services obtained")
      error_code = 3
      writeCharacteristic = await service.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e")
      console.log("Write Characteristics discovered")
      let textEncoder = new TextEncoder()
      let value = textEncoder.encode(input.value)
      writeCharacteristic.writeValueWithoutResponse(value)
      const readCharacteristic = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e")
      console.log("Read Characteristics discovered")
      error_code = 4
      const output = await readCharacteristic.startNotifications()
      outputText.classList.replace("text-muted","text-success")
      error_code = 5
      readCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged)
      error_code = 6
      console.log("notification started successfully")
    }
    catch(e) {
      console.log("err_code",error_code)
      console.log(e)
      if (typeof device !== 'undefined') {
        connectionStatus.textContent = "CONNECTION FAILED"
      }
      else {
        connectionStatus.textContent = "CANCELLED"
      }
    }
    
  }


  controlButton.addEventListener("click", BLEManager)
  sendButton.addEventListener("click", writeValue)
  startButton.addEventListener("click", async () => {
    const sessionId = document.getElementById("inputSession").value;
    const measurementTime = document.getElementById("inputTime").value;
  
    // Validate Session Id and Measurement Time
    if (!sessionId || sessionId < 10) {
      alert("Session Id must be at least 10 or higher.");
      return;
    }
  
    if (!measurementTime) {
      alert("Duration of measurement cannot be empty.");
      return;
    }
  
    try { 
      // Check if the device is paired
      if (!pairedDevices || writeCharacteristic === null) {
        alert("No devices paired");
        return;
      }
  
      await startMeasurement();
      outputText.textContent = "Loading...";
      inputTime.disabled = true;
  
      const predictButton = document.createElement('button');
      predictButton.textContent = "Predict";
      predictButton.disabled = true;
      setTimeout(() => {
        predictButton.disabled = false;
      }, parseInt(inputTime.value) * 1000);
  
      predictButton.classList.add('predictButton', 'btn', 'btn-success');
      predictButton.addEventListener("click", predictResult);
      startButton.replaceWith(predictButton);
    } catch (e) {
      console.log(e);
    }
  });
  

  outputText.addEventListener("click", () =>{
    sendArea.style.display = "flex"
  })

