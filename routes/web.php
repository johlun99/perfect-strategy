<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'menu')->name('menu');
Route::view('/blackjack', 'blackjack')->name('blackjack');
