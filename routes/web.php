<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'menu')->name('menu');
Route::view('/blackjack', 'blackjack')->name('blackjack');
Route::view('/strategy', 'strategy')->name('strategy');
Route::view('/hand-value', 'hand-value')->name('hand-value');
