@extends('layouts.app')

@section('title', 'Hand Value')
@section('body-class', 'game-page')

@push('head')
    @vite(['resources/css/game.css', 'resources/css/hand-value.css', 'resources/js/game/hand-value.ts'])
@endpush

@section('content')
    <main id="table" class="table">
        <a class="table__exit" href="{{ route('menu') }}" data-sound="click">‹ Menu</a>
        <div class="table__topright">
            <button class="table__mute" id="mute" title="Toggle sound" aria-label="Toggle sound">🔊</button>
        </div>

        <div class="coach-scorecard" id="quiz-scorecard"></div>

        <div class="quiz-timer" aria-hidden="true"><span class="quiz-timer__bar"></span></div>

        <section class="quiz">
            <p class="quiz__prompt">What's this hand worth?</p>
            <div class="hand" id="quiz-hand"></div>
        </section>

        <div class="coach-hint" id="quiz-hint" hidden></div>
        <div class="quiz-guide" id="quiz-guide" hidden></div>

        <div class="quiz-options" id="quiz-options"></div>

        <div class="quiz-cardcount" id="quiz-cardcount" role="group" aria-label="Cards per hand">
            <span class="quiz-cardcount__label">Cards</span>
            <button class="quiz-cardcount__opt" data-count="mix">Mix</button>
            <button class="quiz-cardcount__opt" data-count="2">2</button>
            <button class="quiz-cardcount__opt" data-count="3">3</button>
            <button class="quiz-cardcount__opt" data-count="4">4</button>
            <button class="quiz-cardcount__opt" data-count="5">5</button>
        </div>
    </main>
@endsection
