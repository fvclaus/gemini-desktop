import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerItemComponent } from './server-item.component';

describe('ServerItemComponent', () => {
  let component: ServerItemComponent;
  let fixture: ComponentFixture<ServerItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServerItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
