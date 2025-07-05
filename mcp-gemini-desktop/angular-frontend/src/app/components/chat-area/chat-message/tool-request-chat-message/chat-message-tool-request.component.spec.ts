import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolRequestChatMessageComponent } from './chat-message-tool-request.component';

describe('ChatMessageToolRequestComponent', () => {
  let component: ToolRequestChatMessageComponent;
  let fixture: ComponentFixture<ToolRequestChatMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolRequestChatMessageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolRequestChatMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
