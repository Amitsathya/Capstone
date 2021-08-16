import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChatService } from "./service/chat.service";

import { CameraPreview } from '@ionic-native/camera-preview/ngx';
import { SpeechRecognition } from "@ionic-native/speech-recognition/ngx";
import { TextToSpeech } from "@ionic-native/text-to-speech/ngx";
@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [BrowserModule, IonicModule.forRoot(),
    HttpClientModule, AppRoutingModule],
  providers: [ChatService,{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    CameraPreview,SpeechRecognition,TextToSpeech],
  bootstrap: [AppComponent],
})
export class AppModule {}
