import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMessageToolRequestComponent } from './chat-message-tool-request.component';

describe('ChatMessageToolRequestComponent', () => {
  let component: ChatMessageToolRequestComponent;
  let fixture: ComponentFixture<ChatMessageToolRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessageToolRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatMessageToolRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
