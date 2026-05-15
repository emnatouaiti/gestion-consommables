import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-google-callback',
  templateUrl: './google-callback.component.html',
  styleUrls: ['./google-callback.component.css'],
  standalone: false
})
export class GoogleCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const error = params['error'];

      if (error) {
        console.error('Google callback error:', error);
        // Store error message in sessionStorage to display on login page
        try {
          sessionStorage.setItem('google_login_error', error);
        } catch (e) {}
        this.router.navigate(['/login']);
        return;
      }

      if (token) {
        this.authService.handleGoogleCallback(token);
      } else {
        // No token and no error - something went wrong
        try {
          sessionStorage.setItem('google_login_error', 'No authentication token received');
        } catch (e) {}
        this.router.navigate(['/login']);
      }
    });
  }
}
