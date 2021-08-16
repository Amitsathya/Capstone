import { Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { CameraPreview } from '@ionic-native/camera-preview/ngx';
import { SpeechRecognition } from '@ionic-native/speech-recognition/ngx';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import * as coco from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Subject } from 'rxjs';
// import * as faceapi from 'src/assets/face-api.min.js';
import * as faceapi from 'face-api.js';
import { environment } from 'src/environments/environment';
import { createWorker } from 'tesseract.js';
import { ChatService } from '../service/chat.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  BACK_ENABLED: boolean = true;
  worker: Tesseract.Worker;
  workerReady = false;
  messages: any[] = [{ message: 'Hey, How are You?', bot: true }];
  bot: boolean = false;
  iteration: number = 0;
  interval: any;
  private trigger: Subject<void> = new Subject<void>();
  picture: string;
  @ViewChild('imgEl') imgEl: ElementRef;
  @ViewChild('canvasEl') canvasEl: ElementRef;
  recognizedResults: Array<any> = [];

  constructor(
    private preview: CameraPreview,
    private ngZone: NgZone,
    public speechRecognition: SpeechRecognition,
    public tts: TextToSpeech,
    private chatService: ChatService
  ) {
    this.loadWorker();
  }

  async loadWorker() {
    this.worker = createWorker({
      logger: (progress) => {
        console.log(progress);
      },
    });
    await this.worker.load();
    await this.worker.loadLanguage('eng');
    await this.worker.initialize('eng');
    this.workerReady = true;
  }

  async ocr() {
    const result = await this.worker.recognize(this.picture);
    console.log(result);
    let arr = result.data.lines;
    let lines;
    this.messages.push({ message: 'Characters Recognized:', bot: true });
    this.tts.speak({ text: 'Characters Recognized:' });
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].confidence > 65) {
        console.log(1 + ' ' + arr[i]);
        lines += `${arr[i].text} \n`;
      }
    }
    console.log(lines);

    this.messages.push({ message: lines, bot: true });
    this.tts.speak({ text: lines });
  }

  ngOnInit() {
    tf.getBackend()
    this.openCamera();
    this.CheckPermission();
    this.tts.speak({ text: 'Hey, How are You?', rate: 1 });

  }

  openCamera() {
    this.preview.startCamera({ camera: 'rear', width: 100, height: 100 }).then(
      (val) => {},
      (err) => {
        alert(JSON.stringify(err));
      }
    );
  }

  snapshot() {
    this.trigger.subscribe(() => {
      this.preview.takeSnapshot().then(
        (imageData) => {
          this.picture = 'data:image/jpeg;base64,' + imageData;
        },
        (err) => {
          console.log(`Snapshot: ${err}`);
        }
      );
    });
  }

  async imageLoadEvent() {
    let canvas = this.canvasEl.nativeElement;
    let context = canvas.getContext('2d');
    const img = this.imgEl.nativeElement;
    canvas.height = img.clientHeight;
    canvas.width = img.clientWidth;
    const font = '16px sans-serif';
    context.font = font;
    context.baseline = 'top';
    canvas.style.backgroundImage = `url(\'${img.src}\')`;
    canvas.style.backgroundSize = `${img.clientWidth}px ${img.clientHeight}px`;
    canvas.style.backgroundRepeat = 'no-repeat';
    let model = await coco.load();
    let results = await model.detect(img);
    
    results.forEach((prediction) => {
      const x = prediction.bbox[0];
      const y = prediction.bbox[1];
      const width = prediction.bbox[2];
      const height = prediction.bbox[3];

      //bounding box
      context.strokeStyle = '#00FFFF';
      context.lineWidth = 2;
      context.strokeRect(x, y, width, height);

      // object text
      context.fillStyle = '#000000';
      context.fillText(prediction.class, x, y);
    });
    this.iteration += 1;
    for (let i = 0; i < results.length; i++) {
      if (this.recognizedResults.some((e) => e.object === results[i].class)) {
        let index = this.recognizedResults.findIndex(
          (x) => x.object === results[i].class
        );
        if (this.recognizedResults[index].iteration < this.iteration) {
          //If it is in previous iteration, resets count to 2
          this.recognizedResults[index].occ_iteration = 1;
          this.recognizedResults[index].iteration = this.iteration;
        } else {
          //If same iteration, increments count
          this.recognizedResults[index].occ_iteration += 1;
        }
        if (i == results.length - 1) {
          //End of iteration, if greater count, update previous count
          if (
            this.recognizedResults[index].occurrence <
            this.recognizedResults[index].occ_iteration
          ) {
            this.recognizedResults[index].occurrence =
              this.recognizedResults[index].occ_iteration;
          }
        }
        if (this.recognizedResults[index].certainty < results[i].score) {
          this.recognizedResults[index].certainty = results[i].score;
        }
      } else {
        this.recognizedResults.push({
          object: results[i].class,
          certainty: results[i].score,
          occurrence: 1,
          iteration: this.iteration,
          occ_iteration: 1,
        });
      }
    }
    if (this.iteration == 1) {
      clearInterval(this.interval);
      this.iteration=0;
      let items = '';
      let ocr = false;
      for (let i = 0; i < this.recognizedResults.length; i++) {
        items += `There is ${this.recognizedResults[i].occurrence} ${this.recognizedResults[i].object}, `;
        this.recognizedResults[i].object == 'book' ? (ocr = true) : null;
      }
      this.messages.push({ message: 'Items identified: ' + items, bot: true });
      this.tts.speak({ text: 'Items identified: ' + items });
      this.bot = false;
      if (ocr) {
        this.messages.push({
          message: 'Would you like me to read the book?',
          bot: true,
        });
        this.tts.speak({ text: 'Would you like me to read the book?' });
        this.bot = false;
      }
    }
  }

  CheckPermission() {
    this.speechRecognition.hasPermission().then(
      (permission) => {
        if (permission) {
        } else {
          this.RequestPermission();
        }
      },
      (err) => {
        alert(JSON.stringify(err));
      }
    );
  }

  RequestPermission() {
    this.speechRecognition.requestPermission().then(
      (data) => {},
      (err) => {
        alert(JSON.stringify(err));
      }
    );
  }

  StartListening() {
    this.speechRecognition.startListening().subscribe(
      (speeches) => {
        this.ngZone.run(() => {
          this.messages.push({ message: speeches[0], bot: false });
          this.bot = true;
          let messageBack = {
            firstname: environment.firstName,
            text: speeches[0],
          };
          if (
            this.messages[this.messages.length - 2].message ==
              'Would you like me to read the book?' &&
            speeches[0] == 'yes'
          ) {
            this.ocr();
          } else if (this.BACK_ENABLED) {
            this.chatService.sendMessage(messageBack).subscribe((res) => {
              this.BotRespond(res['responseMessage']);
            });
          }
        });
      },
      (err) => {
        alert(JSON.stringify(err));
      }
    );
  }

  BotRespond(text) {
    if (text == 'image') {
      this.snapshot();
      this.interval = setInterval(() => this.trigger.next(), 10000);
      this.recognizedResults=[];
    } else {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.messages.push({ message: text, bot: true });
          this.tts.speak({ text: text });
          this.bot = false;
        });
      }, 3000);
    }
  }
}
// tensorflow-models/mobilenet

// this.mnetModel = await mobilenet.load();
// let results = this.mnetModel.classify(this.imgEl.nativeElement);
// results.then(
//   (res) => {
//     for (let i = 0; i < res.length; i++) {
//         if (this.recognizedResults.some((e) => e.object === res[i].className)) {
//           let index = this.recognizedResults.findIndex(
//             (x) => x.object === res[i].className
//           );
//           if (this.recognizedResults[index].certainty < res[i].probability) {
//             this.recognizedResults[index].certainty = res[i].probability;
//           }
//         } else {
//           this.recognizedResults.push({
//             object: res[i].className,
//             certainty: res[i].probability,
//           });
//         }
//       }
//   },
//   (err) => {
//     alert(JSON.stringify(err));
//   }
// );
//   console.log(this.recognizedResults);

//Face Recognition
// Promise.all([
//   // faceapi.nets.tinyFaceDetector.loadFromUri('assets/models'),
//   faceapi.nets.faceRecognitionNet.loadFromUri('https://blindaid.blob.core.windows.net/models'),
//   faceapi.nets.faceLandmark68Net.loadFromUri('https://blindaid.blob.core.windows.net/models'),
//   faceapi.nets.ssdMobilenetv1.loadFromUri('https://blindaid.blob.core.windows.net/models')
// ]).then(async (x) => {
//   const displaySize = { width: img.clientWidth, height: img.clientHeight }
//   faceapi.matchDimensions(canvas, displaySize);
//   await tf.setBackend('cpu')
//   console.log('Using TensorFlow backend: ', tf.getBackend());
//   const detections = await faceapi
//     .detectAllFaces(
//       this.imgEl.nativeElement,
//       // new faceapi.TinyFaceDetectorOptions()
//     )
//     .withFaceLandmarks()
//     .withFaceExpressions();
//   const resizedDetections = faceapi.resizeResults(
//     detections,
//     displaySize
//   );
//   console.log(resizedDetections);
// },
// (err) => {
//   console.log(JSON.stringify(err));
// })
export class Message {
  text?: string;
  date: string;
  userOwner: boolean;
}

export class ResponseMessage {
  responseMessage?: string;
  originalQuery?: string;
  intent?: string;
}

export class TextMessage {
  firstname: string;
  text: string;
}
